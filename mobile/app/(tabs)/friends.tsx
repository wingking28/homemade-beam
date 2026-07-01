import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  friendsApi,
  usersApi,
  User,
  FriendRequest,
} from '../../src/services/api';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [f, r] = await Promise.all([friendsApi.getAll(), friendsApi.getRequests()]);
      setFriends(f.friends);
      setRequests(r.requests);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { users } = await usersApi.search(q);
      setSearchResults(users);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(userId: string) {
    try {
      await friendsApi.sendRequest(userId);
      setSentRequests((prev) => new Set(prev).add(userId));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    try {
      await friendsApi.respond(requestId, action);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (action === 'accept') load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    }
  }

  async function removeFriend(friend: User) {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await friendsApi.remove(friend.id);
              setFriends((prev) => prev.filter((f) => f.id !== friend.id));
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const friendIds = new Set(friends.map((f) => f.id));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Friends</Text>

        {/* Search */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>
            {searching ? (
              <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.md }} />
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="person-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            ) : (
              searchResults.map((u) => (
                <Card key={u.id} style={styles.userCard}>
                  <View style={styles.userRow}>
                    <Avatar name={u.name} size={44} uri={u.avatarUrl ?? undefined} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userEmail}>{u.email}</Text>
                    </View>
                    {friendIds.has(u.id) ? (
                      <View style={styles.friendsBadge}>
                        <Ionicons name="checkmark" size={13} color={Colors.success} />
                        <Text style={styles.friendsBadgeText}>Friends</Text>
                      </View>
                    ) : sentRequests.has(u.id) ? (
                      <View style={styles.pendingBadge}>
                        <Ionicons name="time-outline" size={13} color={Colors.primary} />
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(u.id)}>
                        <Ionicons name="person-add-outline" size={14} color={Colors.primary} />
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Pending Requests */}
        {requests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Friend Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requests.length}</Text>
              </View>
            </View>
            {requests.map((req) => (
              <Card key={req.id} style={styles.requestCard}>
                <View style={styles.userRow}>
                  <Avatar name={req.sender!.name} size={48} uri={req.sender!.avatarUrl ?? undefined} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{req.sender!.name}</Text>
                    <Text style={styles.userEmail}>{req.sender!.email}</Text>
                    <Text style={styles.requestSubtext}>Wants to be your friend</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => respond(req.id, 'accept')}
                  >
                    <Ionicons name="checkmark" size={15} color="#fff" />
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => respond(req.id, 'decline')}
                  >
                    <Ionicons name="close" size={15} color={Colors.danger} />
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Friends List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Friends</Text>
            {friends.length > 0 && (
              <Text style={styles.sectionCount}>{friends.length}</Text>
            )}
          </View>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>Search for people above to add them.</Text>
            </View>
          ) : (
            friends.map((f) => (
              <Card key={f.id} style={styles.userCard}>
                <View style={styles.userRow}>
                  <Avatar name={f.name} size={44} uri={f.avatarUrl ?? undefined} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{f.name}</Text>
                    <Text style={styles.userEmail}>{f.email}</Text>
                  </View>
                  <TouchableOpacity style={styles.moreBtn} onPress={() => removeFriend(f)}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.lg },

  screenTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },

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
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },

  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  sectionCount: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },

  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  emptySubtext: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },

  userCard: {},
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },

  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  pendingBadgeText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },

  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  friendsBadgeText: { color: Colors.success, fontWeight: '600', fontSize: FontSize.sm },

  moreBtn: { padding: Spacing.xs },

  requestCard: { gap: Spacing.sm },
  requestSubtext: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: Spacing.sm },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  declineBtnText: { color: Colors.danger, fontWeight: '600', fontSize: FontSize.sm },
});
