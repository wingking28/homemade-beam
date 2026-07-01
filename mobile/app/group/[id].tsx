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
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const PAGES = ['Expenses', 'Balances', 'Members'] as const;
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

  // Add expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [adding, setAdding] = useState(false);

  // Pager animation
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -translateX.value / PAGES.length }],
  }));

  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goToPage = useCallback(
    (index: number) => {
      setActivePageIndex(index);
      translateX.value = withSpring(-index * width, SPRING_CONFIG);
    },
    [width],
  );

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
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

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
      setShowAddExpense(false);
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
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await expensesApi.delete(expenseId);
            load();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  if (!group) {
    return <View style={styles.center}><Text>Group not found</Text></View>;
  }

  const myBalance = balances.find((b) => b.user.id === user?.id);
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
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddExpense(true)}>
          <Text style={styles.addBtnText}>+ Expense</Text>
        </TouchableOpacity>
      </View>

      {/* My balance */}
      {myBalance && (
        <View style={styles.myBalance}>
          <Text style={styles.myBalanceLabel}>Your balance</Text>
          <BalanceBadge amount={myBalance.net} size="lg" />
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

            {/* Expenses */}
            <ScrollView style={{ width }} contentContainerStyle={styles.content} refreshControl={refreshControl}>
              {(group.expenses ?? []).length === 0 ? (
                <Text style={styles.empty}>No expenses yet. Add one!</Text>
              ) : (
                (group.expenses ?? []).map((exp: Expense) => {
                  const myShare = exp.shares.find((s) => s.user.id === user?.id);
                  const iPaid = exp.paidBy.id === user?.id;
                  return (
                    <Card key={exp.id}>
                      <View style={styles.expRow}>
                        <Avatar name={exp.paidBy.name} size={40} />
                        <View style={styles.expInfo}>
                          <Text style={styles.expDesc}>{exp.description}</Text>
                          <Text style={styles.expPaid}>{exp.paidBy.name} paid ${Number(exp.amount).toFixed(2)}</Text>
                          <Text style={styles.expDate}>{new Date(exp.createdAt).toLocaleDateString()}</Text>
                        </View>
                        {myShare && !iPaid && <BalanceBadge amount={-myShare.amount} size="sm" />}
                        {iPaid && myShare && <BalanceBadge amount={Number(exp.amount) - Number(myShare.amount)} size="sm" />}
                      </View>
                      {(iPaid || group.members.find((m) => m.userId === user?.id)?.role === 'ADMIN') && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteExpense(exp.id)}>
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </Card>
                  );
                })
              )}
            </ScrollView>

            {/* Balances */}
            <ScrollView style={{ width }} contentContainerStyle={styles.content} refreshControl={refreshControl}>
              {balances.map((b) => (
                <Card key={b.user.id} style={styles.balanceRow}>
                  <Avatar name={b.user.name} size={40} />
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName}>{b.user.name}</Text>
                  </View>
                  <BalanceBadge amount={b.net} size="md" />
                </Card>
              ))}
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
      <Modal visible={showAddExpense} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
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
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowAddExpense(false)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={addExpense} disabled={adding}>
                {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Add Expense</Text>}
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
  deleteBtn: { marginTop: Spacing.sm, paddingVertical: Spacing.xs, alignItems: 'flex-end' },
  deleteBtnText: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  balanceInfo: { flex: 1 },
  balanceName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
