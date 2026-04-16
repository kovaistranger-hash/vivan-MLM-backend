import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Card from '../components/Card';
import { api } from '../services/api';

export default function TeamScreen() {
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/referral/binary-summary')
      .then((res) => {
        const s = res.data?.summary || {};
        setLeft(Number(s.leftCarry ?? 0));
        setRight(Number(s.rightCarry ?? 0));
      })
      .catch(() => {
        setLeft(null);
        setRight(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.page}>
      {loading ? <ActivityIndicator size="large" color="#6366f1" /> : null}
      <Card title="Binary carry (profit)">
        <Text style={styles.line}>Left carry: ₹{left != null ? left.toLocaleString('en-IN') : '—'}</Text>
        <Text style={styles.line}>Right carry: ₹{right != null ? right.toLocaleString('en-IN') : '—'}</Text>
        <Text style={styles.hint}>From `/referral/binary-summary`. Add tree stats for member counts if exposed.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  line: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  hint: { fontSize: 12, color: '#64748b', marginTop: 8 }
});
