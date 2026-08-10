import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Shelter } from '@/types/shelter';
import { Colors } from '@/theme/colors';

interface Props {
  shelter: Shelter | null;
  visible: boolean;
  onClose: () => void;
  onGuide?: (shelter: Shelter) => void;
}

function amenityLabel(value?: string): string {
  if (!value || value === '정보없음') return '정보없음';
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) return n > 0 ? `보유 (${n}대)` : '없음';
  return value;
}

export default function ShelterDetailModal({ shelter, visible, onClose, onGuide }: Props) {
  if (!shelter) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.category}>🌡️ {shelter.category}</Text>
          <Text style={styles.name}>{shelter.name}</Text>
          <Text style={styles.address}>{shelter.roadAddress || shelter.address}</Text>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>시설 유형</Text>
            <Text style={styles.infoValue}>{shelter.facilityType ?? '정보없음'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이용 가능 인원</Text>
            <Text style={styles.infoValue}>
              {shelter.capacity != null ? `약 ${shelter.capacity}명` : '정보없음'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>선풍기</Text>
            <Text style={styles.infoValue}>{amenityLabel(shelter.hasFan)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>에어컨</Text>
            <Text style={styles.infoValue}>{amenityLabel(shelter.hasAircon)}</Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </Pressable>
            {onGuide && (
              <Pressable style={styles.guideButton} onPress={() => onGuide(shelter)}>
                <Text style={styles.guideButtonText}>🧭 이 쉼터로 경로 안내</Text>
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
  category: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 2, color: Colors.textPrimary },
  address: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
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
