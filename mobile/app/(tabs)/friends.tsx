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
      Alert.alert('Sent!', 'Friend request sent.');
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  const friendIds = new Set(friends.map((f) => f.id));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.screenTitle}>Friends</Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {searching ? (
              <ActivityIndicator color={Colors.primary} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.empty}>No users found</Text>
            ) : (
              searchResults.map((u) => (
                <Card key={u.id} style={styles.userCard}>
                  <View style={styles.userRow}>
                    <Avatar name={u.name} size={40} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userEmail}>{u.email}</Text>
                    </View>
                    {!friendIds.has(u.id) && (
                      <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(u.id)}>
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
            <Text style={styles.sectionTitle}>Friend Requests ({requests.length})</Text>
            {requests.map((req) => (
              <Card key={req.id} style={styles.requestCard}>
                <View style={styles.userRow}>
                  <Avatar name={req.sender!.name} size={40} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{req.sender!.name}</Text>
                    <Text style={styles.userEmail}>{req.sender!.email}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => respond(req.id, 'accept')}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => respond(req.id, 'decline')}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Friends List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Friends ({friends.length})</Text>
          {friends.length === 0 ? (
            <Text style={styles.empty}>Search for friends above to add them.</Text>
          ) : (
            friends.map((f) => (
              <Card key={f.id} style={styles.userCard}>
                <View style={styles.userRow}>
                  <Avatar name={f.name} size={40} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{f.name}</Text>
                    <Text style={styles.userEmail}>{f.email}</Text>
                  </View>
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
  content: { padding: Spacing.md, gap: Spacing.md },
  screenTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  searchContainer: {},
  searchInput: {
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },
  userCard: {},
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  addBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  requestCard: { gap: Spacing.sm },
  requestActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  acceptBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  declineBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  declineBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.sm },
});
