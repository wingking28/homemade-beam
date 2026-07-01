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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupsApi, friendsApi, Group, User } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import { GroupAvatar } from '../../src/components/GroupAvatar';
import { Card } from '../../src/components/Card';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create group form state
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const { groups: g } = await groupsApi.getAll();
      setGroups(g);
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

  function toggleFriend(id: string) {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createGroup() {
    if (!groupName.trim()) { Alert.alert('Error', 'Please enter a group name'); return; }
    setCreating(true);
    try {
      await groupsApi.create({
        name: groupName.trim(),
        memberIds: Array.from(selectedFriendIds),
      });
      setShowCreate(false);
      setGroupName('');
      setSelectedFriendIds(new Set());
      load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  function handleLongPress(group: Group) {
    const isAdmin = group.members.some(
      (m) => m.userId === currentUser?.id && m.role === 'ADMIN'
    );
    if (!isAdmin) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupsApi.delete(group.id);
              setGroups((prev) => prev.filter((g) => g.id !== group.id));
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete group');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.screenTitle}>Groups</Text>

        {groups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyDesc}>Create a group to start splitting expenses with friends.</Text>
          </Card>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              onLongPress={() => handleLongPress(group)}
              delayLongPress={500}
            >
              <Card style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <GroupAvatar uri={group.avatarUrl} size={48} />
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    {group.description && (
                      <Text style={styles.groupDesc} numberOfLines={1}>{group.description}</Text>
                    )}
                    <Text style={styles.memberCount}>{group.members.length} members</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                {/* Avatar stack */}
                <View style={styles.avatarStack}>
                  {group.members.slice(0, 5).map((m, i) => (
                    <View key={m.id} style={[styles.avatarWrap, { left: i * 22 }]}>
                      <Avatar name={m.user.name} size={28} uri={m.user.avatarUrl ?? undefined} />
                    </View>
                  ))}
                  {group.members.length > 5 && (
                    <View style={[styles.avatarMore, { left: 5 * 22 }]}>
                      <Text style={styles.avatarMoreText}>+{group.members.length - 5}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Group name"
              placeholderTextColor={Colors.textMuted}
              value={groupName}
              onChangeText={setGroupName}
            />
            <Text style={styles.modalSubtitle}>Add friends</Text>
            <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
              {friends.map((f) => {
                const selected = selectedFriendIds.has(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.friendItem, selected && styles.friendItemSelected]}
                    onPress={() => toggleFriend(f.id)}
                  >
                    <Avatar name={f.name} size={36} uri={f.avatarUrl ?? undefined} />
                    <Text style={styles.friendName}>{f.name}</Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              {friends.length === 0 && (
                <Text style={styles.empty}>Add friends first from the Friends tab.</Text>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={createGroup} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  screenTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  emptyCard: { alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  groupCard: { gap: Spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  groupInfo: { flex: 1 },
  groupName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  groupDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  memberCount: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted },
  avatarStack: { flexDirection: 'row', height: 28, marginTop: Spacing.xs },
  avatarWrap: { position: 'absolute', borderWidth: 2, borderColor: Colors.surface, borderRadius: 14 },
  avatarMore: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  avatarMoreText: { fontSize: 9, fontWeight: '700', color: Colors.primary },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  modalInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  modalSubtitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  friendList: { maxHeight: 200, marginBottom: Spacing.md },
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
  checkmark: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.md },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  createBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700' },
});
