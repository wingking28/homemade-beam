import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Returns a base64 JPEG data URI, or null if the user cancelled the picker.
export async function pickAndResizeSquareImage(size = 200): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Please allow access to your photo library to upload a photo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled) return null;

  const resized = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: size, height: size } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!resized.base64) throw new Error('Failed to process image.');

  return `data:image/jpeg;base64,${resized.base64}`;
}
