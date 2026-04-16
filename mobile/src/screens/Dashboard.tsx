import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import Card from '../components/Card';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [totalIncome, setTotalIncome] = useState<number | null>(null);
  const [todayIncome, setTodayIncome] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/wallet')
      .then((res) => {
        const bal = Number(res.data?.wallet?.balance ?? 0);
        setTotalIncome(bal);
        setTodayIncome(null);
      })
      .catch(() => {
        setTotalIncome(null);
        setTodayIncome(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.page}>
      {loading ? <ActivityIndicator size="large" color="#6366f1" /> : null}
      <Card title="Wallet balance">
        <Text style={styles.big}>₹{totalIncome != null ? totalIncome.toLocaleString('en-IN') : '—'}</Text>
        <Text style={styles.muted}>Connect auth + API URL to load live data.</Text>
      </Card>
      <Card title="Today (placeholder)">
        <Text style={styles.mid}>₹{todayIncome != null ? todayIncome.toLocaleString('en-IN') : '—'}</Text>
      </Card>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => navigation.navigate('Team')}>
          <Text style={styles.btnText}>Team</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => navigation.navigate('Income')}>
          <Text style={styles.btnText}>Income</Text>
        </Pressable>
      </View>
      <Pressable style={[styles.btn, styles.btnWide]} onPress={() => navigation.navigate('BinaryCalculator')}>
        <Text style={styles.btnText}>Binary calculator</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  big: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  mid: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  muted: { marginTop: 6, fontSize: 12, color: '#64748b' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnWide: { marginTop: 12, width: '100%' }
});
