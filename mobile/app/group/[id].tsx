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
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  groupsApi,
  expensesApi,
  Group,
  Expense,
  Balance,
} from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { BalanceBadge } from '../../src/components/BalanceBadge';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const PAGES = ['Expenses', 'History', 'Members'] as const;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

export default function GroupDetailScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [group, setGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Expense detail modal
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedExpenseIsHistory, setSelectedExpenseIsHistory] = useState(false);
  const [settling, setSettling] = useState(false);

  // Add expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [adding, setAdding] = useState(false);

  // History tab state
  const [historyExpenses, setHistoryExpenses] = useState<Expense[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyOrder, setHistoryOrder] = useState<'desc' | 'asc'>('desc');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const historyInitializedRef = useRef(false);
  const historyOrderRef = useRef<'desc' | 'asc'>('desc');

  // Pager animation
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -translateX.value / PAGES.length }],
  }));

  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Modal animations — backdrop fades, sheet slides independently
  const addExpenseBackdrop = useSharedValue(0);
  const addExpenseSheetY = useSharedValue(600);
  const detailBackdrop = useSharedValue(0);
  const detailSheetY = useSharedValue(600);

  const addExpenseBackdropStyle = useAnimatedStyle(() => ({ opacity: addExpenseBackdrop.value }));
  const addExpenseSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: addExpenseSheetY.value }],
  }));
  const detailBackdropStyle = useAnimatedStyle(() => ({ opacity: detailBackdrop.value }));
  const detailSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: detailSheetY.value }],
  }));

  const goToPage = useCallback(
    (index: number) => {
      setActivePageIndex(index);
      translateX.value = withSpring(-index * width, SPRING_CONFIG);
    },
    [width],
  );

  function openAddExpenseModal() {
    setShowAddExpense(true);
    addExpenseBackdrop.value = withTiming(1, { duration: 220 });
    addExpenseSheetY.value = withSpring(0, SPRING_CONFIG);
  }

  function closeAddExpenseModal() {
    addExpenseBackdrop.value = withTiming(0, { duration: 180 });
    addExpenseSheetY.value = withTiming(600, { duration: 220 }, (finished) => {
      if (finished) runOnJS(setShowAddExpense)(false);
    });
  }

  function openDetailModal(expense: Expense, isHistory = false) {
    setSelectedExpense(expense);
    setSelectedExpenseIsHistory(isHistory);
    detailBackdrop.value = withTiming(1, { duration: 220 });
    detailSheetY.value = withSpring(0, SPRING_CONFIG);
  }

  function closeDetailModal() {
    detailBackdrop.value = withTiming(0, { duration: 180 });
    detailSheetY.value = withTiming(600, { duration: 220 }, (finished) => {
      if (finished) runOnJS(setSelectedExpense)(null);
    });
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate(({ translationX }) => {
      const next = startX.value + translationX;
      const minX = -(PAGES.length - 1) * width;
      translateX.value = Math.max(minX, Math.min(0, next));
    })
    .onEnd(({ velocityX }) => {
      const closestPage = Math.round(-translateX.value / width);
      let target = Math.max(0, Math.min(PAGES.length - 1, closestPage));

      if (velocityX < -500 && target < PAGES.length - 1) target += 1;
      else if (velocityX > 500 && target > 0) target -= 1;

      translateX.value = withSpring(-target * width, SPRING_CONFIG);
      runOnJS(setActivePageIndex)(target);
    });

  const loadHistory = useCallback(async (page: number, order: 'desc' | 'asc', reset?: boolean) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const result = await expensesApi.getHistory(id, { page, order });
      setHistoryExpenses((prev) => (reset ? result.expenses : [...prev, ...result.expenses]));
      setHistoryHasMore(result.hasMore);
      setHistoryPage(page);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  async function load() {
    if (!id) return;
    try {
      const [g, b] = await Promise.all([
        groupsApi.get(id),
        groupsApi.getBalances(id),
      ]);
      setGroup(g.group);
      setBalances(b.balances);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // Lazy-load history when the History tab is first visited
  useEffect(() => {
    if (activePageIndex === 1 && !historyInitializedRef.current) {
      historyInitializedRef.current = true;
      loadHistory(1, historyOrderRef.current, true);
    }
  }, [activePageIndex, loadHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    if (historyInitializedRef.current) {
      loadHistory(1, historyOrderRef.current, true);
    }
  }, [loadHistory]);

  function toggleHistoryOrder() {
    const newOrder = historyOrderRef.current === 'desc' ? 'asc' : 'desc';
    historyOrderRef.current = newOrder;
    setHistoryOrder(newOrder);
    setHistoryExpenses([]);
    loadHistory(1, newOrder, true);
  }

  function loadMoreHistory() {
    if (historyLoading || !historyHasMore) return;
    loadHistory(historyPage + 1, historyOrderRef.current);
  }

  const filteredHistoryExpenses = historySearchQuery.trim()
    ? historyExpenses.filter((exp) =>
        exp.description.toLowerCase().includes(historySearchQuery.trim().toLowerCase())
      )
    : historyExpenses;

  async function addExpense() {
    if (!expDesc.trim() || !expAmount) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    setAdding(true);
    try {
      await expensesApi.create(id!, { description: expDesc.trim(), amount });
      closeAddExpenseModal();
      setExpDesc('');
      setExpAmount('');
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setAdding(false);
    }
  }

  async function deleteExpense(expenseId: string) {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense? This will permanently remove it for all group members.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await expensesApi.delete(expenseId);
            load();
            if (historyInitializedRef.current) {
              loadHistory(1, historyOrderRef.current, true);
            }
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          }
        },
      },
    ]);
  }

  async function settleMyShare(shareId: string) {
    setSettling(true);
    try {
      await expensesApi.settleShare(shareId);
      closeDetailModal();
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSettling(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  if (!group) {
    return <View style={styles.center}><Text>Group not found</Text></View>;
  }

  const myBalance = balances.find((b) => b.user.id === user?.id);
  const isAdmin = group.members.find((m) => m.user.id === user?.id)?.role === 'ADMIN';
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>{group.members.length} members</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddExpenseModal}>
          <Text style={styles.addBtnText}>+ Expense</Text>
        </TouchableOpacity>
      </View>

      {/* My balance */}
      {myBalance && (
        <View style={styles.myBalance}>
          <Text style={styles.myBalanceLabel}>Your balance</Text>
          <BalanceBadge amount={myBalance.net} size="lg" firstPerson />
        </View>
      )}

      {/* Tab bar with sliding indicator */}
      <View style={styles.tabs}>
        <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
        {PAGES.map((name, i) => (
          <TouchableOpacity key={i} style={styles.tabBtn} onPress={() => goToPage(i)}>
            <Text style={[styles.tabText, activePageIndex === i && styles.tabTextActive]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pager */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.pager}>
          <Animated.View style={[{ flexDirection: 'row', flex: 1, width: width * PAGES.length }, pagerStyle]}>

            {/* Expenses — active (unsettled) only */}
            <ScrollView style={{ width }} contentContainerStyle={styles.content} refreshControl={refreshControl}>
              {(group.expenses ?? []).length === 0 ? (
                <Text style={styles.empty}>No active expenses. Add one!</Text>
              ) : (
                (group.expenses ?? []).map((exp: Expense) => {
                  const myShare = exp.shares.find((s) => s.user.id === user?.id);
                  const iPaid = exp.paidBy.id === user?.id;
                  return (
                    <TouchableOpacity key={exp.id} onPress={() => openDetailModal(exp)} activeOpacity={0.7}>
                      <Card>
                        <View style={styles.expRow}>
                          <Avatar name={exp.paidBy.name} size={40} />
                          <View style={styles.expInfo}>
                            <Text style={styles.expDesc}>{exp.description}</Text>
                            <Text style={styles.expPaid}>{exp.paidBy.name} paid ${Number(exp.amount).toFixed(2)}</Text>
                            <Text style={styles.expDate}>{new Date(exp.createdAt).toLocaleDateString()}</Text>
                          </View>
                          {myShare && !iPaid && !myShare.isPaid && <BalanceBadge amount={-myShare.amount} size="sm" firstPerson />}
                          {myShare && !iPaid && myShare.isPaid && <BalanceBadge amount={0} size="sm" />}
                          {iPaid && myShare && <BalanceBadge amount={Number(exp.amount) - Number(myShare.amount)} size="sm" firstPerson />}
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* History — fully settled expenses, paginated */}
            <ScrollView style={{ width }} contentContainerStyle={styles.content} refreshControl={refreshControl}>
              {/* Search */}
              <View style={styles.searchWrapper}>
                <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search expenses..."
                  placeholderTextColor={Colors.textMuted}
                  value={historySearchQuery}
                  onChangeText={setHistorySearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {historySearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Sort toggle */}
              <View style={styles.historyHeader}>
                <Text style={styles.historyOrderLabel}>
                  {historyOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                </Text>
                <TouchableOpacity onPress={toggleHistoryOrder} style={styles.sortToggleBtn}>
                  <Text style={styles.sortToggleText}>
                    {historyOrder === 'desc' ? '↑ Oldest first' : '↓ Newest first'}
                  </Text>
                </TouchableOpacity>
              </View>

              {historyLoading && historyExpenses.length === 0 ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
              ) : historyExpenses.length === 0 ? (
                <Text style={styles.empty}>No completed expenses yet.</Text>
              ) : filteredHistoryExpenses.length === 0 ? (
                <Text style={styles.empty}>No expenses match your search.</Text>
              ) : (
                filteredHistoryExpenses.map((exp) => (
                  <TouchableOpacity key={exp.id} onPress={() => openDetailModal(exp, true)} activeOpacity={0.7}>
                    <Card>
                      <View style={styles.expRow}>
                        <Avatar name={exp.paidBy.name} size={40} />
                        <View style={styles.expInfo}>
                          <Text style={styles.expDesc}>{exp.description}</Text>
                          <Text style={styles.expPaid}>{exp.paidBy.name} paid ${Number(exp.amount).toFixed(2)}</Text>
                          <Text style={styles.expDate}>{new Date(exp.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.settledBadge}>
                          <Text style={styles.settledBadgeText}>Settled</Text>
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))
              )}

              {historyHasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={loadMoreHistory}
                  disabled={historyLoading}
                >
                  {historyLoading ? (
                    <ActivityIndicator color={Colors.primary} size="small" />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Members */}
            <ScrollView style={{ width }} contentContainerStyle={styles.content} refreshControl={refreshControl}>
              {group.members.map((m) => (
                <Card key={m.id} style={styles.memberRow}>
                  <Avatar name={m.user.name} size={40} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.user.name}</Text>
                    <Text style={styles.memberEmail}>{m.user.email}</Text>
                  </View>
                  {m.role === 'ADMIN' && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminText}>Admin</Text>
                    </View>
                  )}
                </Card>
              ))}
            </ScrollView>

          </Animated.View>
        </View>
      </GestureDetector>

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} animationType="none" transparent statusBarTranslucent>
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.backdrop, addExpenseBackdropStyle]} />
          <Animated.View style={[styles.modalSheet, addExpenseSheetStyle, { paddingBottom: Math.max(Spacing.lg, insets.bottom) + 12 }]}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <Text style={styles.modalHint}>Will be split equally among all {group.members.length} members.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Description (e.g. Dinner)"
              placeholderTextColor={Colors.textMuted}
              value={expDesc}
              onChangeText={setExpDesc}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Total amount (e.g. 48.00)"
              placeholderTextColor={Colors.textMuted}
              value={expAmount}
              onChangeText={setExpAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={closeAddExpenseModal}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={addExpense} disabled={adding}>
                {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Add Expense</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Expense Detail Modal */}
      <Modal visible={!!selectedExpense} animationType="none" transparent statusBarTranslucent onRequestClose={closeDetailModal}>
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.backdrop, detailBackdropStyle]} />
          <Animated.View style={[styles.modalSheet, detailSheetStyle, { paddingBottom: Math.max(Spacing.lg, insets.bottom) + 12 }]}>
            {selectedExpense && (
              <>
                <View style={styles.expDetailHeader}>
                  <View style={styles.expDetailInfo}>
                    <Text style={styles.modalTitle}>{selectedExpense.description}</Text>
                    <Text style={styles.expDetailMeta}>
                      {selectedExpense.paidBy.name} paid ${Number(selectedExpense.amount).toFixed(2)} · {new Date(selectedExpense.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeDetailModal} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.shareHeading}>Who owes what</Text>
                {selectedExpense.shares.map((s) => {
                  const isPayer = s.user.id === selectedExpense.paidBy.id;
                  const isMe = s.user.id === user?.id;
                  return (
                    <View key={s.id} style={styles.shareRow}>
                      <Avatar name={s.user.name} size={36} />
                      <Text style={styles.shareName}>{isMe ? 'You' : s.user.name}</Text>
                      {isPayer ? (
                        <View style={styles.paidBadge}>
                          <Text style={styles.paidBadgeText}>paid</Text>
                        </View>
                      ) : (
                        <View style={[styles.oweBadge, s.isPaid && styles.oweBadgeSettled]}>
                          <Text style={[styles.oweBadgeText, s.isPaid && styles.oweBadgeTextSettled]}>
                            {s.isPaid ? 'paid' : `owes $${Number(s.amount).toFixed(2)}`}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {(() => {
                  const myShare = selectedExpense.shares.find((s) => s.user.id === user?.id);
                  const iPaid = selectedExpense.paidBy.id === user?.id;
                  if (!iPaid && myShare && !myShare.isPaid) {
                    return (
                      <TouchableOpacity
                        style={styles.settleBtn}
                        onPress={() => settleMyShare(myShare.id)}
                        disabled={settling}
                      >
                        {settling
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={styles.settleBtnText}>Mark as Paid</Text>
                        }
                      </TouchableOpacity>
                    );
                  }
                  return null;
                })()}

                {(selectedExpenseIsHistory ? isAdmin : selectedExpense.paidBy.id === user?.id) && (
                  <TouchableOpacity
                    style={styles.deleteExpenseBtn}
                    onPress={() => {
                      closeDetailModal();
                      deleteExpense(selectedExpense.id);
                    }}
                  >
                    <Text style={styles.deleteExpenseBtnText}>Delete Expense</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  backText: { fontSize: 28, color: Colors.primary, lineHeight: 28 },
  headerInfo: { flex: 1 },
  groupName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  memberCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  myBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  myBalanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '33.333%',
    height: 2,
    backgroundColor: Colors.primary,
  },
  tabBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  pager: { flex: 1, overflow: 'hidden' },
  content: { padding: Spacing.md, gap: Spacing.sm },
  empty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.xl },
  expRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  expInfo: { flex: 1 },
  expDesc: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  expPaid: { fontSize: FontSize.sm, color: Colors.textSecondary },
  expDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  expDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  expDetailInfo: { flex: 1 },
  expDetailMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: Spacing.xs },
  closeBtnText: { fontSize: FontSize.md, color: Colors.textMuted },
  shareHeading: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  shareName: { flex: 1, fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  paidBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  paidBadgeText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '700' },
  oweBadge: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  oweBadgeSettled: { backgroundColor: Colors.successLight },
  oweBadgeText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: '700' },
  oweBadgeTextSettled: { color: Colors.success },
  settleBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  settleBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  deleteExpenseBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
  },
  deleteExpenseBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  memberEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  adminBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  adminText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },
  // History tab
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
    marginBottom: Spacing.sm,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  historyOrderLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sortToggleBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortToggleText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  settledBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  settledBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '700',
  },
  loadMoreBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  loadMoreText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
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
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalHint: { fontSize: FontSize.sm, color: Colors.textSecondary },
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
  cancelModalText: { color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
