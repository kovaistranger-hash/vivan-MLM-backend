import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'BinaryCalculator'>;

type Stats = {
  leftBV: number;
  rightBV: number;
  todayBinaryIncome: number;
  totalBinaryIncome: number;
  weakLeg: 'left' | 'right';
};

export default function BinaryCalculatorScreen(_props: Props) {
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [ratePct, setRatePct] = useState(10);
  const [match, setMatch] = useState(0);
  const [income, setIncome] = useState(0);
  const [leftCarry, setLeftCarry] = useState(0);
  const [rightCarry, setRightCarry] = useState(0);

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Stats & { success?: boolean }>('/binary/stats');
      const d = res.data;
      const l = Number(d.leftBV ?? 0);
      const r = Number(d.rightBV ?? 0);
      setLeft(l);
      setRight(r);
      setStats({
        leftBV: l,
        rightBV: r,
        todayBinaryIncome: Number(d.todayBinaryIncome ?? 0),
        totalBinaryIncome: Number(d.totalBinaryIncome ?? 0),
        weakLeg: d.weakLeg === 'right' ? 'right' : 'left'
      });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const m = Math.min(left, right);
    setMatch(m);
    setIncome(Math.floor(m * (ratePct / 100)));
    setLeftCarry(left - m);
    setRightCarry(right - m);
  }, [left, right, ratePct]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchData();
  };

  const totalLeg = left + right;
  const leftBar = totalLeg > 0 ? Math.round((left / totalLeg) * 100) : 50;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Binary calculator</Text>

      {loading && !stats ? <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 16 }} /> : null}

      {stats ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live from API</Text>
          <Text style={styles.row}>Today (binary, IST): ₹{stats.todayBinaryIncome.toFixed(2)}</Text>
          <Text style={styles.row}>Lifetime binary: ₹{stats.totalBinaryIncome.toFixed(2)}</Text>
          <Text style={styles.row}>Weak leg: {stats.weakLeg}</Text>
        </View>
      ) : null}

      <View style={styles.barWrap}>
        <View style={[styles.barLeft, { flex: leftBar }]} />
        <View style={[styles.barRight, { flex: 100 - leftBar }]} />
      </View>
      <Text style={styles.barLabel}>Carry mix · left {leftBar}%</Text>

      <Text style={styles.label}>Left BV</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={String(left)}
        onChangeText={(val) => setLeft(Number(val) || 0)}
      />

      <Text style={styles.label}>Right BV</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={String(right)}
        onChangeText={(val) => setRight(Number(val) || 0)}
      />

      <Text style={styles.label}>Binary % (estimate)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={String(ratePct)}
        onChangeText={(val) => {
          const n = Number(val);
          setRatePct(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
        }}
      />

      <Pressable style={styles.refreshBtn} onPress={() => void fetchData()}>
        <Text style={styles.refreshBtnText}>Refresh</Text>
      </Pressable>

      <View style={styles.grid}>
        <View style={styles.cellMuted}>
          <Text style={styles.cellLabel}>Match BV</Text>
          <Text style={styles.cellValue}>{match}</Text>
        </View>
        <View style={styles.cellGreen}>
          <Text style={styles.cellLabel}>Est. income</Text>
          <Text style={styles.cellValue}>₹{income}</Text>
        </View>
        <View style={styles.cellBlue}>
          <Text style={styles.cellLabel}>Left carry</Text>
          <Text style={styles.cellValue}>{leftCarry}</Text>
        </View>
        <View style={styles.cellPurple}>
          <Text style={styles.cellLabel}>Right carry</Text>
          <Text style={styles.cellValue}>{rightCarry}</Text>
        </View>
      </View>

      <Text style={styles.hint}>Pull down to refresh. Set EXPO_PUBLIC_API_URL and sign in with a valid access token.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  row: { fontSize: 13, color: '#475569', marginBottom: 4 },
  barWrap: { flexDirection: 'row', height: 10, borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  barLeft: { backgroundColor: '#0ea5e9' },
  barRight: { backgroundColor: '#7c3aed' },
  barLabel: { fontSize: 11, color: '#64748b', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    marginBottom: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#0f172a'
  },
  refreshBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20
  },
  refreshBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cellMuted: {
    width: '48%',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  cellGreen: {
    width: '48%',
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  cellBlue: {
    width: '48%',
    backgroundColor: '#e0f2fe',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  cellPurple: {
    width: '48%',
    backgroundColor: '#ede9fe',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  cellLabel: { fontSize: 12, color: '#475569' },
  cellValue: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  hint: { marginTop: 20, fontSize: 11, color: '#64748b', textAlign: 'center' }
});
