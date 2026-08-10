import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { ConvenienceStore } from '@/types/store';
import { Colors } from '@/theme/colors';

interface Props {
  store: ConvenienceStore | null;
  visible: boolean;
  onClose: () => void;
  onGuide?: (store: ConvenienceStore) => void;
}

export default function StoreDetailModal({ store, visible, onClose, onGuide }: Props) {
  if (!store) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.brand}>{store.brand}</Text>
          <Text style={styles.name}>{store.name}</Text>
          <Text style={styles.address}>{store.roadAddress || store.address}</Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </Pressable>
            {onGuide && (
              <Pressable style={styles.guideButton} onPress={() => onGuide(store)}>
                <Text style={styles.guideButtonText}>🧭 이 편의점으로 경로 안내</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  brand: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 2, color: Colors.textPrimary },
  address: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  closeButton: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  closeButtonText: { color: Colors.textPrimary, fontWeight: '600' },
  guideButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  guideButtonText: { color: Colors.textOnPrimary, fontWeight: '700' },
});
