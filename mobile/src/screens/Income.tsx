import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Card from '../components/Card';
import { api } from '../services/api';

export default function IncomeScreen() {
  const [loading, setLoading] = useState(false);
  const [bin, setBin] = useState<number | null>(null);
  const [dir, setDir] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/referral/binary-summary')
      .then((res) => {
        const s = res.data?.summary || {};
        setBin(Number(s.lifetimeBinaryMatchInr ?? 0));
        setDir(Number(s.lifetimeDirectReferralInr ?? 0));
      })
      .catch(() => {
        setBin(null);
        setDir(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.page}>
      {loading ? <ActivityIndicator size="large" color="#6366f1" /> : null}
      <Card title="Binary income (lifetime wallet)">
        <Text style={styles.amount}>₹{bin != null ? bin.toLocaleString('en-IN') : '—'}</Text>
        <Text style={styles.sub}>From `/referral/binary-summary`.</Text>
      </Card>
      <Card title="Direct income (lifetime wallet)">
        <Text style={styles.amount}>₹{dir != null ? dir.toLocaleString('en-IN') : '—'}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  amount: { fontSize: 24, fontWeight: '700', color: '#15803d' },
  sub: { marginTop: 6, fontSize: 12, color: '#64748b' }
});
