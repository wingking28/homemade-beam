import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { authApi } from '../../src/services/api';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

type EditingField = 'name' | null;

export default function ProfileScreen() {
  const { user, updateUser, clearAuth } = useAuthStore();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [nameValue, setNameValue] = useState(user?.name ?? '');
  const [savingField, setSavingField] = useState<EditingField>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function startEdit(field: EditingField) {
    if (field === 'name') setNameValue(user?.name ?? '');
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
  }

  async function saveField(field: EditingField) {
    if (field === 'name') {
      const trimmed = nameValue.trim();
      if (trimmed.length < 2) {
        Alert.alert('Invalid name', 'Name must be at least 2 characters.');
        return;
      }
      setSavingField('name');
      try {
        const { user: updated } = await authApi.updateProfile({ name: trimmed });
        await updateUser(updated);
        setEditingField(null);
      } catch (err: any) {
        Alert.alert('Error', err.message ?? 'Failed to save.');
      } finally {
        setSavingField(null);
      }
    }
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const resized = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 200, height: 200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!resized.base64) throw new Error('Failed to process image.');

      const base64Uri = `data:image/jpeg;base64,${resized.base64}`;
      const { user: updated } = await authApi.updateProfile({ avatarUrl: base64Uri });
      await updateUser(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (!user) return null;

  const isEditingName = editingField === 'name';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.screenTitle}>Profile</Text>

          {/* Avatar with camera overlay */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Avatar name={user.name} size={88} uri={user.avatarUrl ?? undefined} />
              <TouchableOpacity
                style={styles.cameraOverlay}
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="camera" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          {/* Info card with per-field editing */}
          <Card style={styles.infoCard}>
            {/* Name row */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              {isEditingName ? (
                <View style={styles.inlineEditRow}>
                  <TextInput
                    style={styles.inlineInput}
                    value={nameValue}
                    onChangeText={setNameValue}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => saveField('name')}
                  />
                  {savingField === 'name' ? (
                    <ActivityIndicator color={Colors.primary} size="small" style={{ marginLeft: Spacing.sm }} />
                  ) : (
                    <View style={styles.inlineActions}>
                      <TouchableOpacity onPress={cancelEdit} style={styles.iconBtn}>
                        <Ionicons name="close" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => saveField('name')} style={styles.iconBtn}>
                        <Ionicons name="checkmark" size={18} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.valueRow}>
                  <Text style={styles.infoValue}>{user.name}</Text>
                  <TouchableOpacity onPress={() => startEdit('name')} style={styles.pencilBtn}>
                    <Ionicons name="pencil" size={15} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Email row (read-only) */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>

            {user.createdAt && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Member since</Text>
                  <Text style={styles.infoValue}>
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </>
            )}
          </Card>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  screenTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  avatarSection: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  avatarWrapper: { position: 'relative' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoCard: { gap: Spacing.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pencilBtn: { padding: 4 },
  inlineEditRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  inlineInput: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
    minWidth: 100,
    maxWidth: 160,
    textAlign: 'right',
  },
  inlineActions: { flexDirection: 'row', marginLeft: Spacing.xs },
  iconBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: Colors.border },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  logoutBtnText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.md },
});
