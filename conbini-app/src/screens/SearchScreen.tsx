import React, { useState } from 'react';
import {
  View,
  TextInput,
  SectionList,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { searchStores } from '@/api/stores';
import { searchShelters } from '@/api/shelters';
import { ConvenienceStore } from '@/types/store';
import { Shelter } from '@/types/shelter';
import { RootTabParamList } from '@/navigation/RootNavigator';
import { Colors } from '@/theme/colors';
import { useCurrentLocation } from '@/hooks/useLocation';

type Nav = BottomTabNavigationProp<RootTabParamList>;

type SearchSection =
  | { title: string; type: 'store'; data: ConvenienceStore[] }
  | { title: string; type: 'shelter'; data: Shelter[] };

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const { location } = useCurrentLocation();
  const [keyword, setKeyword] = useState('');
  const [storeResults, setStoreResults] = useState<ConvenienceStore[]>([]);
  const [shelterResults, setShelterResults] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (text: string) => {
    setKeyword(text);
    if (text.trim().length < 2) {
      setStoreResults([]);
      setShelterResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const [stores, shelters] = await Promise.all([
        searchStores(text, location ?? undefined),
        searchShelters(text, '무더위쉼터'),
      ]);
      setStoreResults(stores);
      setShelterResults(shelters);
    } catch (e) {
      console.warn('검색 실패', e);
    } finally {
      setLoading(false);
    }
  };

  const goToStore = (store: ConvenienceStore) => {
    navigation.navigate('Map', { focusStore: store, navKey: Date.now() });
  };

  const goToShelter = (shelter: Shelter) => {
    navigation.navigate('Map', { focusShelter: shelter, navKey: Date.now() });
  };

  const sections: SearchSection[] = [
    ...(storeResults.length > 0
      ? [{ title: `🏪 편의점 (${storeResults.length})`, type: 'store' as const, data: storeResults }]
      : []),
    ...(shelterResults.length > 0
      ? [{ title: `🌡️ 무더위쉼터 (${shelterResults.length})`, type: 'shelter' as const, data: shelterResults }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="편의점 이름, 쉼터 이름, 지역으로 검색"
        value={keyword}
        onChangeText={handleSearch}
        autoCorrect={false}
      />

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

      {!loading && (
        <SectionList
          sections={sections as any}
          keyExtractor={(item: any) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }: any) => (
            <Pressable
              style={styles.item}
              onPress={() =>
                section.type === 'store' ? goToStore(item) : goToShelter(item)
              }
            >
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemAddress}>
                {item.roadAddress || item.address}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            searched ? (
              <Text style={styles.empty}>검색 결과가 없습니다.</Text>
            ) : (
              <Text style={styles.empty}>편의점 또는 무더위쉼터를 검색해보세요.</Text>
            )
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: Colors.background },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    color: Colors.textPrimary,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  item: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  itemAddress: { fontSize: 13, color: Colors.textSecondary },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
});
