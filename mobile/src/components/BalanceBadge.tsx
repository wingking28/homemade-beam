import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize, Spacing } from '../constants/theme';

interface BalanceBadgeProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(amount)
  );
}

export function BalanceBadge({ amount, size = 'md' }: BalanceBadgeProps) {
  const isPositive = amount > 0;
  const isZero = amount === 0;

  const bg = isZero ? Colors.border : isPositive ? Colors.successLight : Colors.dangerLight;
  const color = isZero ? Colors.textMuted : isPositive ? Colors.success : Colors.danger;
  const label = isZero ? 'Settled' : isPositive ? `+${formatCurrency(amount)}` : `-${formatCurrency(amount)}`;

  const fontSize = size === 'sm' ? FontSize.xs : size === 'lg' ? FontSize.lg : FontSize.sm;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontWeight: '600' },
});
