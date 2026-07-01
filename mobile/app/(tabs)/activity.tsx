import { useEffect, useState, useCallback } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  paymentRequestsApi,
  friendsApi,
  PaymentRequest,
  User,
} from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

type Tab = 'received' | 'sent';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('received');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create request form
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const { requests: r } = await paymentRequestsApi.getAll('all');
      setRequests(r);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function openCreate() {
    try {
      const { friends: f } = await friendsApi.getAll();
      setFriends(f);
    } catch {
      setFriends([]);
    }
    setShowCreate(true);
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
      setShowCreate(false);
      setSelectedFriendId('');
      setAmount('');
      setDescription('');
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function markPaid(id: string) {
    try {
      await paymentRequestsApi.updateStatus(id, 'PAID');
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  }

  async function cancelRequest(id: string) {
    try {
      await paymentRequestsApi.updateStatus(id, 'CANCELLED');
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  }

  const filtered = requests.filter((r) =>
    tab === 'received' ? r.receiverId === user?.id : r.senderId === user?.id
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
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
            onPress={() => setTab('received')}
          >
            <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>I Owe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]}
            onPress={() => setTab('sent')}
          >
            <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Owe Me</Text>
          </TouchableOpacity>
        </View>

        {filtered.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'received' ? 'No requests to pay yet.' : 'No requests sent yet.'}
          </Text>
        ) : (
          filtered.map((req) => {
            const other = tab === 'received' ? req.sender : req.receiver;
            const statusColor =
              req.status === 'PAID' ? Colors.success :
              req.status === 'CANCELLED' ? Colors.textMuted : '#F59E0B';

            return (
              <Card key={req.id} style={styles.reqCard}>
                <View style={styles.reqRow}>
                  <Avatar name={other.name} size={40} />
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
      </ScrollView>

      {/* Create Request Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>New Payment Request</Text>

            <Text style={styles.modalLabel}>Request from</Text>
            <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
              {friends.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.friendItem, selectedFriendId === f.id && styles.friendItemSelected]}
                  onPress={() => setSelectedFriendId(f.id)}
                >
                  <Avatar name={f.name} size={32} />
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
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={createRequest} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
