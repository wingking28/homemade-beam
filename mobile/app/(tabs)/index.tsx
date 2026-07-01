import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTabNavigation } from '../../src/context/TabNavigationContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupsApi, paymentRequestsApi, Group, PaymentRequest } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { BalanceBadge } from '../../src/components/BalanceBadge';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { goToTab } = useTabNavigation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [groupOwed, setGroupOwed] = useState(0);
  const [groupOwing, setGroupOwing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [settling, setSettling] = useState(false);

  const detailBackdrop = useSharedValue(0);
  const detailSheetY = useSharedValue(600);

  const detailBackdropStyle = useAnimatedStyle(() => ({ opacity: detailBackdrop.value }));
  const detailSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: detailSheetY.value }],
  }));

  function openRequestModal(req: PaymentRequest) {
    setSelectedRequest(req);
    detailBackdrop.value = withTiming(1, { duration: 220 });
    detailSheetY.value = withSpring(0, SPRING_CONFIG);
  }

  function closeRequestModal() {
    detailBackdrop.value = withTiming(0, { duration: 180 });
    detailSheetY.value = withTiming(600, { duration: 220 }, (finished) => {
      if (finished) runOnJS(setSelectedRequest)(null);
    });
  }

  async function markAsPaid(id: string) {
    setSettling(true);
    try {
      await paymentRequestsApi.updateStatus(id, 'PAID');
      closeRequestModal();
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSettling(false);
    }
  }

  async function load() {
    try {
      const [g, r] = await Promise.all([
        groupsApi.getAll(),
        paymentRequestsApi.getAll('all'),
      ]);
      setGroups(g.groups);
      setRequests(r.requests);

      const userId = useAuthStore.getState().user?.id;
      const balanceResults = await Promise.all(g.groups.map((group) => groupsApi.getBalances(group.id)));
      let owed = 0;
      let owing = 0;
      balanceResults.forEach((result) => {
        const mine = result.balances.find((b) => b.user.id === userId);
        if (mine) {
          if (mine.net > 0) owed += mine.net;
          else owing += Math.abs(mine.net);
        }
      });
      setGroupOwed(owed);
      setGroupOwing(owing);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const pendingReceived = requests.filter(
    (r) => r.receiverId === user?.id && r.status === 'PENDING'
  );
  const pendingSent = requests.filter(
    (r) => r.senderId === user?.id && r.status === 'PENDING'
  );

  const totalOwed = pendingSent.reduce((s, r) => s + Number(r.amount), 0) + groupOwed;
  const totalOwing = pendingReceived.reduce((s, r) => s + Number(r.amount), 0) + groupOwing;
  const netBalance = totalOwed - totalOwing;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name}>{user?.name ?? 'there'} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => goToTab(4)}>
            <Avatar name={user?.name ?? '?'} size={44} uri={user?.avatarUrl ?? undefined} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <Card style={[styles.balanceCard, { backgroundColor: Colors.primary }]}>
          <Text style={styles.balanceLabel}>Overall Balance</Text>
          <Text style={[styles.balanceAmount, { color: netBalance > 0 ? Colors.success : netBalance < 0 ? Colors.danger : '#FFFFFF' }]}>
            {netBalance > 0 ? '+' : netBalance < 0 ? '-' : ''}${Math.abs(netBalance).toFixed(2)}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>You are owed</Text>
              <Text style={[styles.balanceStatValue, { color: Colors.success }]}>
                ${totalOwed.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.balanceDivider]} />
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>You owe</Text>
              <Text style={[styles.balanceStatValue, { color: '#FF8C94' }]}>
                ${totalOwing.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity onPress={() => goToTab(2)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {groups.length === 0 ? (
            <Card>
              <Text style={styles.empty}>No groups yet. Create one!</Text>
            </Card>
          ) : (
            groups.slice(0, 3).map((group) => (
              <TouchableOpacity
                key={group.id}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              >
                <Card style={styles.groupCard}>
                  <View style={styles.groupCardInner}>
                    <View style={styles.groupIcon}>
                      <Text style={styles.groupIconText}>{group.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <Text style={styles.groupMembers}>{group.members.length} members</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Pending requests */}
        {pendingReceived.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingReceived.slice(0, 3).map((req) => (
              <TouchableOpacity key={req.id} onPress={() => openRequestModal(req)} activeOpacity={0.7}>
                <Card style={styles.requestCard}>
                  <View style={styles.requestRow}>
                    <Avatar name={req.sender.name} size={36} />
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestSender}>{req.sender.name}</Text>
                      <Text style={styles.requestDesc}>{req.description}</Text>
                    </View>
                    <BalanceBadge amount={-Number(req.amount)} size="sm" firstPerson />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Request Detail Modal */}
      <Modal visible={!!selectedRequest} animationType="none" transparent statusBarTranslucent onRequestClose={closeRequestModal}>
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.backdrop, detailBackdropStyle]} />
          <Animated.View style={[styles.modalSheet, detailSheetStyle, { paddingBottom: Math.max(Spacing.lg, insets.bottom) + 12 }]}>
            {selectedRequest && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderInfo}>
                    <Text style={styles.modalTitle}>{selectedRequest.description}</Text>
                    <Text style={styles.modalMeta}>
                      From {selectedRequest.sender.name} · {new Date(selectedRequest.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeRequestModal} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Amount requested</Text>
                  <Text style={styles.amountValue}>${Number(selectedRequest.amount).toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.settleBtn}
                  onPress={() => markAsPaid(selectedRequest.id)}
                  disabled={settling}
                >
                  {settling
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.settleBtnText}>Mark as Paid</Text>
                  }
                </TouchableOpacity>
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
  content: { padding: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  greeting: { fontSize: FontSize.md, color: Colors.textSecondary },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  balanceCard: { padding: Spacing.lg, gap: Spacing.sm },
  balanceLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  balanceAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', marginTop: Spacing.sm },
  balanceStat: { flex: 1, alignItems: 'center' },
  balanceStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  balanceStatValue: { fontSize: FontSize.lg, fontWeight: '700', marginTop: 2 },
  balanceDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: Spacing.md },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  empty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  groupCard: { marginBottom: 0 },
  groupCardInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIconText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  groupInfo: { flex: 1 },
  groupName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  groupMembers: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted },
  requestCard: {},
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  requestInfo: { flex: 1 },
  requestSender: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  requestDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
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
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  modalHeaderInfo: { flex: 1 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: Spacing.xs },
  closeBtnText: { fontSize: FontSize.md, color: Colors.textMuted },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  amountLabel: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
  amountValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  settleBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  settleBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});
