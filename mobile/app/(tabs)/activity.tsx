import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  paymentRequestsApi,
  friendsApi,
  PaymentRequest,
  User,
} from '../../src/services/api';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

type Tab = 'received' | 'sent';
type StatusFilter = 'all' | 'active' | 'inactive';
type Order = 'desc' | 'asc';

const PAGE_SIZE = 20;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('received');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [order, setOrder] = useState<Order>('desc');

  const tabRef = useRef(tab);
  const statusFilterRef = useRef(statusFilter);
  const orderRef = useRef(order);
  const searchRef = useRef(search);
  const didMountRef = useRef(false);

  // Create request form
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Modal animation — backdrop fades, sheet slides independently
  const createBackdrop = useSharedValue(0);
  const createSheetY = useSharedValue(600);
  const createBackdropStyle = useAnimatedStyle(() => ({ opacity: createBackdrop.value }));
  const createSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: createSheetY.value }],
  }));

  const load = useCallback(async (pageToLoad: number, reset: boolean) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const { requests: r, hasMore: more } = await paymentRequestsApi.getAll({
        type: tabRef.current,
        page: pageToLoad,
        limit: PAGE_SIZE,
        order: orderRef.current,
        status: statusFilterRef.current === 'all' ? undefined : statusFilterRef.current,
        search: searchRef.current || undefined,
      });
      setRequests((prev) => (reset ? r : [...prev, ...r]));
      setHasMore(more);
      setPage(pageToLoad);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(1, true); }, [load]);

  // Debounce search input before triggering a server-side search
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      searchRef.current = search;
      return;
    }
    searchRef.current = search;
    load(1, true);
  }, [search, load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(1, true); }, [load]);

  function selectTab(next: Tab) {
    setTab(next);
    tabRef.current = next;
    load(1, true);
  }

  function selectStatusFilter(next: StatusFilter) {
    setStatusFilter(next);
    statusFilterRef.current = next;
    load(1, true);
  }

  function toggleOrder() {
    const next: Order = orderRef.current === 'desc' ? 'asc' : 'desc';
    setOrder(next);
    orderRef.current = next;
    load(1, true);
  }

  function loadMore() {
    if (loading || loadingMore || !hasMore) return;
    load(page + 1, false);
  }

  async function openCreate() {
    try {
      const { friends: f } = await friendsApi.getAll();
      setFriends(f);
    } catch {
      setFriends([]);
    }
    setShowCreate(true);
    createBackdrop.value = withTiming(1, { duration: 220 });
    createSheetY.value = withSpring(0, SPRING_CONFIG);
  }

  function closeCreate() {
    createBackdrop.value = withTiming(0, { duration: 180 });
    createSheetY.value = withTiming(600, { duration: 220 }, (finished) => {
      if (finished) runOnJS(setShowCreate)(false);
    });
  }

  async function createRequest() {
    if (!selectedFriendId || !amount || !description) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    setCreating(true);
    try {
      await paymentRequestsApi.create({ receiverId: selectedFriendId, amount: amountNum, description });
      closeCreate();
      setSelectedFriendId('');
      setAmount('');
      setDescription('');
      load(1, true);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function markPaid(id: string) {
    try {
      await paymentRequestsApi.updateStatus(id, 'PAID');
      load(1, true);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  }

  async function cancelRequest(id: string) {
    try {
      await paymentRequestsApi.updateStatus(id, 'CANCELLED');
      load(1, true);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Requests</Text>
          <TouchableOpacity style={styles.newBtn} onPress={openCreate}>
            <Text style={styles.newBtnText}>+ Request</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'received' && styles.tabBtnActive]}
            onPress={() => selectTab('received')}
          >
            <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>I Owe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]}
            onPress={() => selectTab('sent')}
          >
            <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Owe Me</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search requests..."
            placeholderTextColor={Colors.textMuted}
            value={searchInput}
            onChangeText={setSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status filter + sort */}
        <View style={styles.filterRow}>
          <View style={styles.chipGroup}>
            {(['all', 'active', 'inactive'] as StatusFilter[]).map((sf) => (
              <TouchableOpacity
                key={sf}
                style={[styles.chip, statusFilter === sf && styles.chipActive]}
                onPress={() => selectStatusFilter(sf)}
              >
                <Text style={[styles.chipText, statusFilter === sf && styles.chipTextActive]}>
                  {sf === 'all' ? 'All' : sf === 'active' ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={toggleOrder} style={styles.sortToggleBtn}>
            <Text style={styles.sortToggleText}>
              {order === 'desc' ? '↓ Newest' : '↑ Oldest'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading && requests.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : requests.length === 0 ? (
          <Text style={styles.empty}>
            {search
              ? 'No requests match your search.'
              : tab === 'received' ? 'No requests to pay yet.' : 'No requests sent yet.'}
          </Text>
        ) : (
          requests.map((req) => {
            const other = tab === 'received' ? req.sender : req.receiver;
            const statusColor =
              req.status === 'PAID' ? Colors.success :
              req.status === 'CANCELLED' ? Colors.textMuted : '#F59E0B';

            return (
              <Card key={req.id} style={styles.reqCard}>
                <View style={styles.reqRow}>
                  <Avatar name={other.name} size={40} uri={other.avatarUrl ?? undefined} />
                  <View style={styles.reqInfo}>
                    <Text style={styles.reqName}>{other.name}</Text>
                    <Text style={styles.reqDesc}>{req.description}</Text>
                    <Text style={styles.reqDate}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.reqRight}>
                    <Text style={styles.reqAmount}>
                      ${Number(req.amount).toFixed(2)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{req.status}</Text>
                    </View>
                  </View>
                </View>

                {req.status === 'PENDING' && tab === 'received' && (
                  <TouchableOpacity style={styles.paidBtn} onPress={() => markPaid(req.id)}>
                    <Text style={styles.paidBtnText}>Mark as Paid</Text>
                  </TouchableOpacity>
                )}
                {req.status === 'PENDING' && tab === 'sent' && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelRequest(req.id)}>
                    <Text style={styles.cancelBtnText}>Cancel Request</Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          })
        )}

        {hasMore && (
          <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={styles.loadMoreText}>Load more</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Create Request Modal */}
      <Modal visible={showCreate} animationType="none" transparent statusBarTranslucent onRequestClose={closeCreate}>
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.backdrop, createBackdropStyle]} />
          <Animated.View style={[styles.modalSheet, createSheetStyle, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>New Payment Request</Text>

            <Text style={styles.modalLabel}>Request from</Text>
            <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
              {friends.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.friendItem, selectedFriendId === f.id && styles.friendItemSelected]}
                  onPress={() => setSelectedFriendId(f.id)}
                >
                  <Avatar name={f.name} size={32} uri={f.avatarUrl ?? undefined} />
                  <Text style={styles.friendName}>{f.name}</Text>
                  {selectedFriendId === f.id && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              ))}
              {friends.length === 0 && <Text style={styles.empty}>No friends yet.</Text>}
            </ScrollView>

            <TextInput
              style={styles.modalInput}
              placeholder="Amount (e.g. 25.50)"
              placeholderTextColor={Colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="What's it for? (e.g. Dinner)"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={closeCreate}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={createRequest} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  newBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  tabs: { flexDirection: 'row', backgroundColor: Colors.border, borderRadius: Radius.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm },
  tabBtnActive: { backgroundColor: Colors.surface },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  chipGroup: { flexDirection: 'row', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.primary },
  sortToggleBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortToggleText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  loadMoreBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  loadMoreText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  empty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg, fontSize: FontSize.sm },
  reqCard: { gap: Spacing.sm },
  reqRow: { flexDirection: 'row', gap: Spacing.md },
  reqInfo: { flex: 1 },
  reqName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  reqDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  reqDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  reqRight: { alignItems: 'flex-end', gap: 4 },
  reqAmount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  paidBtn: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  paidBtnText: { color: Colors.success, fontWeight: '700', fontSize: FontSize.sm },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.sm },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  friendList: { maxHeight: 160 },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  friendItemSelected: { backgroundColor: Colors.primaryLight },
  friendName: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  check: { color: Colors.primary, fontWeight: '700' },
  modalInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelModalBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelModalBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  sendBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
});
