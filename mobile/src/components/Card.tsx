import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = { title: string; children: ReactNode };

export default function Card({ title, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8
  }
});
