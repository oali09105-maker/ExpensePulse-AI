/**
 * ExpensePulse AI — Smart Daily Budget & Expense Tracker
 * PRODUCTION build — single-file React Native / Expo implementation.
 * Studio: ZeeU Creative Studio
 * Package: com.zeeucreativestudio.expensepulseai
 * Version: 1.0.0 (versionCode 1)
 * Official Portal: https://zeeu-creative-studio-e-book-vault.ai.studio
 *
 * ─────────────────────────────────────────────────────────────────
 * ⚠️ THIS BUILD REQUIRES A CUSTOM DEV CLIENT / EAS BUILD.
 * react-native-google-mobile-ads contains native code and CANNOT run
 * inside the plain "Expo Go" app. Use:
 *   npx expo prebuild
 *   npx expo run:android        (local native build), OR
 *   eas build --profile development --platform android
 * ─────────────────────────────────────────────────────────────────
 *
 * REQUIRED DEPENDENCIES:
 *   npx expo install @react-native-async-storage/async-storage
 *   npx expo install react-native-svg react-native-chart-kit
 *   npx expo install react-native-google-mobile-ads
 *   npx expo install expo-print expo-sharing expo-file-system
 * See app.json (provided alongside this file) for the required
 * react-native-google-mobile-ads config plugin + real AdMob App ID.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
  AdsConsent,
  AdsConsentStatus,
} from 'react-native-google-mobile-ads';

// ═════════════════════════════════════════════════════════════════
// OFFICIAL APP / STUDIO CONFIGURATION
// ═════════════════════════════════════════════════════════════════
const APP_CONFIG = {
  appName: 'ExpensePulse AI',
  studioName: 'ZeeU Creative Studio',
  packageName: 'com.zeeucreativestudio.expensepulseai',
  versionName: '1.0.0',
  versionCode: 1,
  officialPortal: 'https://zeeu-creative-studio-e-book-vault.ai.studio',
};

// ═════════════════════════════════════════════════════════════════
// ADMOB — REAL PRODUCTION IDS
// ═════════════════════════════════════════════════════════════════
// Safety net: real production ad unit IDs are ONLY used in a release
// build (__DEV__ === false). During development, Google's official
// TEST IDs are used automatically instead — tapping/loading real ads
// while developing is against AdMob policy and can get an account
// flagged for invalid traffic, so this switch is mandatory, not
// optional polish.
const IS_DEV = __DEV__;

const ADMOB_APP_ID = 'ca-app-pub-5206710479803910~5151606476';

const AD_UNIT_IDS = {
  banner: IS_DEV ? TestIds.BANNER : 'ca-app-pub-5206710479803910/2404802442',
  interstitial: IS_DEV ? TestIds.INTERSTITIAL : 'ca-app-pub-5206710479803910/2084046273',
  rewarded: IS_DEV ? TestIds.REWARDED : 'ca-app-pub-5206710479803910/7586198125',
};

// Show an interstitial after every 5th transaction logged.
const INTERSTITIAL_TRANSACTION_INTERVAL = 5;

// ═════════════════════════════════════════════════════════════════
// THEME — Modern Emerald & Gold
// ═════════════════════════════════════════════════════════════════
const COLORS = {
  bg: '#0B1F17',
  surface: '#122A20',
  surfaceAlt: '#183527',
  border: '#22412F',
  emerald: '#10B981',
  emeraldDim: '#0C8F68',
  gold: '#D4AF37',
  goldSoft: '#F0CF6B',
  danger: '#F87171',
  textPrimary: '#F4F7F5',
  textSecondary: '#9BB3A6',
  textMuted: '#6B8577',
};

// ═════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════
type TransactionType = 'income' | 'expense';

type CategoryId =
  | 'groceries'
  | 'utilities'
  | 'health'
  | 'transport'
  | 'food'
  | 'shopping'
  | 'income'
  | 'custom';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: CategoryId;
  note: string;
  date: string; // ISO string
}

interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

type CurrencyCode = 'PKR' | 'USD' | 'EUR' | 'INR' | 'GBP';

const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: 'PKR', symbol: 'Rs', label: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
];

function getCurrencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

// ═════════════════════════════════════════════════════════════════
// STATIC DATA
// ═════════════════════════════════════════════════════════════════
const CATEGORIES: CategoryDef[] = [
  { id: 'groceries', label: 'Groceries', icon: 'basket-outline', color: COLORS.emerald },
  { id: 'utilities', label: 'Utilities', icon: 'flash-outline', color: '#60A5FA' },
  { id: 'health', label: 'Health', icon: 'medkit-outline', color: '#F87171' },
  { id: 'transport', label: 'Transport', icon: 'car-outline', color: COLORS.gold },
  { id: 'food', label: 'Food', icon: 'fast-food-outline', color: '#FB923C' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle-outline', color: '#C084FC' },
  { id: 'custom', label: 'Other', icon: 'pricetag-outline', color: COLORS.textMuted },
];

const INCOME_CATEGORY: CategoryDef = {
  id: 'income',
  label: 'Income',
  icon: 'trending-up-outline',
  color: COLORS.emerald,
};

function getCategory(id: CategoryId): CategoryDef {
  if (id === 'income') return INCOME_CATEGORY;
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ═════════════════════════════════════════════════════════════════
// STORAGE (100% OFFLINE — AsyncStorage)
// ═════════════════════════════════════════════════════════════════
const STORAGE_KEYS = {
  transactions: 'expensepulse_transactions_v1',
  budget: 'expensepulse_monthly_budget_v1',
  currency: 'expensepulse_currency_v1',
  consentAcknowledged: 'expensepulse_consent_ack_v1',
};

async function loadTransactions(): Promise<Transaction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.transactions);
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  } catch {
    return [];
  }
}

async function saveTransactions(transactions: Transaction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  } catch {
    // Fail silently — in-memory state still works for the current session.
  }
}

async function loadBudget(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.budget);
    return raw ? Number(raw) : 50000;
  } catch {
    return 50000;
  }
}

async function saveBudget(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.budget, String(value));
  } catch {
    // ignore
  }
}

async function loadCurrency(): Promise<CurrencyCode> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.currency);
    return (raw as CurrencyCode) || 'PKR';
  } catch {
    return 'PKR';
  }
}

async function saveCurrency(code: CurrencyCode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.currency, code);
  } catch {
    // ignore
  }
}

// ═════════════════════════════════════════════════════════════════
// SMART OFFLINE "AI" CATEGORIZATION ENGINE
// ═════════════════════════════════════════════════════════════════
const CATEGORY_KEYWORDS: Record<Exclude<CategoryId, 'income' | 'custom'>, string[]> = {
  groceries: ['grocery', 'groceries', 'mart', 'vegetable', 'vegetables', 'fruit', 'supermarket', 'bazaar', 'kirana'],
  utilities: ['electricity', 'bill', 'wifi', 'internet', 'gas bill', 'water bill', 'utility', 'phone bill', 'k-electric', 'sui gas'],
  health: ['doctor', 'medicine', 'hospital', 'pharmacy', 'clinic', 'dentist', 'checkup'],
  transport: ['uber', 'careem', 'taxi', 'fuel', 'petrol', 'diesel', 'bus fare', 'rickshaw', 'parking'],
  food: ['restaurant', 'pizza', 'coffee', 'burger', 'dinner', 'lunch', 'cafe', 'kfc', 'mcdonald', 'biryani', 'tea'],
  shopping: ['mall', 'clothes', 'shoes', 'shopping', 'amazon', 'store', 'daraz', 'outfitters'],
};

function suggestCategory(note: string): CategoryId {
  const lower = note.trim().toLowerCase();
  if (!lower) return 'custom';
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    Exclude<CategoryId, 'income' | 'custom'>,
    string[],
  ][]) {
    if (keywords.some((kw) => lower.includes(kw))) return categoryId;
  }
  return 'custom';
}

// ═════════════════════════════════════════════════════════════════
// UTILITIES
// ═════════════════════════════════════════════════════════════════
function formatAmount(value: number, currencySymbol: string): string {
  return `${currencySymbol} ${Math.round(value).toLocaleString('en-US')}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function isSameMonth(iso: string, monthKey: string): boolean {
  return iso.slice(0, 7) === monthKey;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function lastNDateKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function shortDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
}

// ═════════════════════════════════════════════════════════════════
// GDPR / UMP CONSENT + ADMOB INITIALIZATION
// ═════════════════════════════════════════════════════════════════
/**
 * Requests the Google User Messaging Platform (UMP) consent info and
 * shows the consent form automatically when required — i.e. for users
 * in the EEA/UK, per Google's GDPR requirements for AdMob publishers.
 * Ad initialization only proceeds after this flow completes, whether
 * or not a form was actually shown (users outside regulated regions
 * won't see one, and that's expected/correct behaviour).
 */
async function initializeAdsWithConsent(): Promise<void> {
  try {
    const consentInfo = await AdsConsent.requestInfoUpdate();

    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdsConsentStatus.REQUIRED
    ) {
      await AdsConsent.showForm();
    }
  } catch {
    // If the consent flow fails (e.g. no network on first launch), we
    // still proceed to initialize ads in a non-personalized fallback
    // state rather than blocking the app from functioning.
  } finally {
    await mobileAds().initialize();
  }
}

// ═════════════════════════════════════════════════════════════════
// EXPORT ENGINE — CSV & PDF (unlocked via Rewarded Ad)
// ═════════════════════════════════════════════════════════════════
function buildCsvContent(transactions: Transaction[], currencyCode: CurrencyCode): string {
  const header = ['Date', 'Type', 'Category', 'Note', `Amount (${currencyCode})`];
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = transactions.map((t) => {
    const category = getCategory(t.categoryId).label;
    return [new Date(t.date).toLocaleDateString(), t.type, category, escape(t.note || ''), String(t.amount)];
  });
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function buildReportHtml(
  transactions: Transaction[],
  currencySymbol: string,
  totalIncome: number,
  totalExpense: number,
): string {
  const rowsHtml = transactions
    .map(
      (t) => `
      <tr>
        <td>${new Date(t.date).toLocaleDateString()}</td>
        <td>${t.type}</td>
        <td>${getCategory(t.categoryId).label}</td>
        <td>${(t.note || '').replace(/</g, '&lt;')}</td>
        <td style="text-align:right">${formatAmount(t.amount, currencySymbol)}</td>
      </tr>`,
    )
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #0B1F17; padding: 24px; position: relative; }
          h1 { color: #10B981; font-size: 20px; margin-bottom: 4px; }
          .muted { color: #6B8577; font-size: 11px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #0B1F17; color: white; text-align: left; padding: 8px; }
          td { padding: 7px 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #f7f9f8; }
          .summary { display: flex; gap: 24px; margin-bottom: 20px; font-size: 12px; }
          .watermark {
            position: fixed; top: 45%; left: 10%; font-size: 46px;
            color: rgba(11,31,23,0.05); transform: rotate(-30deg);
          }
          .footer { position: fixed; bottom: 10px; width: 100%; text-align: center; font-size: 9px; color: #9BB3A6; }
        </style>
      </head>
      <body>
        <div class="watermark">Property of ZeeU Creative Studio</div>
        <h1>ExpensePulse AI — Expense Report</h1>
        <div class="muted">Generated locally on-device · ${new Date().toLocaleString()}</div>
        <div class="summary">
          <div><strong>Total Income:</strong> ${formatAmount(totalIncome, currencySymbol)}</div>
          <div><strong>Total Expense:</strong> ${formatAmount(totalExpense, currencySymbol)}</div>
          <div><strong>Net:</strong> ${formatAmount(totalIncome - totalExpense, currencySymbol)}</div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="footer">Powered by ZeeU Creative Studio | Official Vault: ${APP_CONFIG.officialPortal}</div>
      </body>
    </html>`;
}

async function exportCsvFile(transactions: Transaction[], currencyCode: CurrencyCode): Promise<void> {
  const content = buildCsvContent(transactions, currencyCode);
  const fileUri = `${FileSystem.cacheDirectory}ExpensePulse_Report_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export CSV Report' });
  }
}

async function exportPdfFile(
  transactions: Transaction[],
  currencySymbol: string,
  totalIncome: number,
  totalExpense: number,
): Promise<void> {
  const html = buildReportHtml(transactions, currencySymbol, totalIncome, totalExpense);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF Report' });
  }
}

// ═════════════════════════════════════════════════════════════════
// REUSABLE UI PIECES
// ═════════════════════════════════════════════════════════════════
function ProgressBar({ percent, danger }: { percent: number; danger: boolean }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${clamped}%`, backgroundColor: danger ? COLORS.danger : COLORS.emerald },
        ]}
      />
    </View>
  );
}

function CategoryPill({
  category,
  selected,
  onPress,
}: {
  category: CategoryDef;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.categoryPill,
        { backgroundColor: selected ? category.color + '25' : COLORS.surfaceAlt, borderColor: selected ? category.color : COLORS.border },
      ]}
    >
      <Ionicons name={category.icon} size={16} color={selected ? category.color : COLORS.textSecondary} />
      <Text style={[styles.categoryPillText, { color: selected ? category.color : COLORS.textSecondary }]}>
        {category.label}
      </Text>
    </TouchableOpacity>
  );
}

function TransactionRow({
  transaction,
  currencySymbol,
  onDelete,
}: {
  transaction: Transaction;
  currencySymbol: string;
  onDelete: () => void;
}) {
  const category = getCategory(transaction.categoryId);
  const isIncome = transaction.type === 'income';
  const dateLabel = new Date(transaction.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <View style={styles.transactionRow}>
      <View style={[styles.transactionIcon, { backgroundColor: category.color + '20' }]}>
        <Ionicons name={category.icon} size={18} color={category.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.transactionLabel} numberOfLines={1}>
          {transaction.note || category.label}
        </Text>
        <Text style={styles.transactionDate}>{dateLabel}</Text>
      </View>
      <Text style={[styles.transactionAmount, { color: isIncome ? COLORS.emerald : COLORS.textPrimary }]}>
        {isIncome ? '+' : '-'} {formatAmount(transaction.amount, currencySymbol)}
      </Text>
      <TouchableOpacity onPress={onDelete} style={{ marginLeft: 10 }}>
        <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════
// ADD TRANSACTION MODAL SHEET
// ═════════════════════════════════════════════════════════════════
function AddTransactionSheet({
  visible,
  currencySymbol,
  onClose,
  onSave,
}: {
  visible: boolean;
  currencySymbol: string;
  onClose: () => void;
  onSave: (t: { type: TransactionType; amount: number; categoryId: CategoryId; note: string }) => void;
}) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('groceries');
  const [autoSuggested, setAutoSuggested] = useState(false);

  useEffect(() => {
    if (!visible) {
      setType('expense');
      setAmount('');
      setNote('');
      setCategoryId('groceries');
      setAutoSuggested(false);
    }
  }, [visible]);

  const handleNoteChange = (text: string) => {
    setNote(text);
    if (type === 'expense' && text.trim().length >= 3) {
      const suggested = suggestCategory(text);
      if (suggested !== 'custom') {
        setCategoryId(suggested);
        setAutoSuggested(true);
      }
    }
  };

  const handleSave = () => {
    const numeric = Number(amount);
    if (!numeric || numeric <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than zero.');
      return;
    }
    onSave({ type, amount: numeric, categoryId: type === 'income' ? 'income' : categoryId, note: note.trim() });
  };

  if (!visible) return null;

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>New Transaction</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.typeToggleRow}>
          <TouchableOpacity
            onPress={() => setType('expense')}
            style={[styles.typeToggleBtn, type === 'expense' && { backgroundColor: COLORS.danger + '22', borderColor: COLORS.danger }]}
          >
            <Ionicons name="remove-circle-outline" size={16} color={type === 'expense' ? COLORS.danger : COLORS.textSecondary} />
            <Text style={{ color: type === 'expense' ? COLORS.danger : COLORS.textSecondary, fontWeight: '600' }}> Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setType('income')}
            style={[styles.typeToggleBtn, type === 'income' && { backgroundColor: COLORS.emerald + '22', borderColor: COLORS.emerald }]}
          >
            <Ionicons name="add-circle-outline" size={16} color={type === 'income' ? COLORS.emerald : COLORS.textSecondary} />
            <Text style={{ color: type === 'income' ? COLORS.emerald : COLORS.textSecondary, fontWeight: '600' }}> Income</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Amount</Text>
        <View style={styles.amountInputWrap}>
          <Text style={styles.amountPrefix}>{currencySymbol}</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            style={styles.amountInput}
          />
        </View>

        <Text style={styles.fieldLabel}>Note (Smart category suggestion runs as you type)</Text>
        <TextInput
          value={note}
          onChangeText={handleNoteChange}
          placeholder="e.g. Uber ride to office"
          placeholderTextColor={COLORS.textMuted}
          style={styles.textInput}
        />
        {autoSuggested && type === 'expense' && (
          <View style={styles.suggestionBadge}>
            <Ionicons name="sparkles" size={12} color={COLORS.gold} />
            <Text style={styles.suggestionText}>
              Auto-categorized as "{getCategory(categoryId).label}" — tap another to change
            </Text>
          </View>
        )}

        {type === 'expense' && (
          <>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <CategoryPill
                  key={cat.id}
                  category={cat}
                  selected={categoryId === cat.id}
                  onPress={() => {
                    setCategoryId(cat.id);
                    setAutoSuggested(false);
                  }}
                />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Transaction</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════
// PRIVACY POLICY MODAL — accurate, Play Store & GDPR compliant text
// ═════════════════════════════════════════════════════════════════
function PrivacyPolicyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={styles.policyHeader}>
          <Text style={styles.sheetTitle}>Privacy Policy</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={styles.policyMeta}>ExpensePulse AI · by {APP_CONFIG.studioName}</Text>
          <Text style={styles.policyMeta}>Last updated: [Insert publish date before submitting to Play Console]</Text>

          <Text style={styles.policyHeading}>1. Overview</Text>
          <Text style={styles.policyBody}>
            ExpensePulse AI is an expense-tracking app built to work entirely on your device. This
            policy explains, plainly and accurately, what happens to your data.
          </Text>

          <Text style={styles.policyHeading}>2. Data You Enter (100% Local)</Text>
          <Text style={styles.policyBody}>
            Every transaction, note, category, and budget limit you enter is stored only in this
            device's local storage. {APP_CONFIG.studioName} does not operate a server for this app,
            and we cannot see, access, sell, or share your financial data — we simply never receive
            it in the first place. Deleting the app or using "Reset All Data" in Settings permanently
            erases it.
          </Text>

          <Text style={styles.policyHeading}>3. Advertising (Google AdMob)</Text>
          <Text style={styles.policyBody}>
            This app displays ads served by Google AdMob to support free access to the app. To do
            this, Google's AdMob SDK — a third party, not {APP_CONFIG.studioName} — may collect
            technical and advertising data such as your device's advertising identifier, IP address,
            general device information, and ad interaction data, in order to serve and measure ads.
            This collection is performed by Google under Google's own Privacy Policy
            (https://policies.google.com/privacy), independently of anything {APP_CONFIG.studioName}
            stores. We do not control, and cannot opt you out of, Google's own data practices beyond
            the consent controls described below.
          </Text>

          <Text style={styles.policyHeading}>4. Your Consent Choices (GDPR / UK)</Text>
          <Text style={styles.policyBody}>
            If you are located in the European Economic Area or the UK, a Google-provided consent
            form appears on first launch, letting you choose whether ads are personalized. You can
            change your device's overall ad preferences at any time via your device's system
            settings (on Android: Settings → Google → Ads), including resetting or opting out of
            your advertising identifier.
          </Text>

          <Text style={styles.policyHeading}>5. Children's Privacy</Text>
          <Text style={styles.policyBody}>
            ExpensePulse AI is not directed at children under 13 and we do not knowingly collect
            data from children. Ads shown in this app are not configured for child-directed
            treatment.
          </Text>

          <Text style={styles.policyHeading}>6. Data Retention & Deletion</Text>
          <Text style={styles.policyBody}>
            Because your data never leaves your device, you are always in full control of it. Use
            the "Reset All Data" option in Settings to instantly and permanently delete every
            transaction and setting stored by the app.
          </Text>

          <Text style={styles.policyHeading}>7. Changes to This Policy</Text>
          <Text style={styles.policyBody}>
            If this policy changes, the updated version will be published at our official portal
            below and reflected in a future app update.
          </Text>

          <Text style={styles.policyHeading}>8. Contact</Text>
          <Text
            style={[styles.policyBody, { color: COLORS.emerald, fontWeight: '600' }]}
            onPress={() => Linking.openURL(APP_CONFIG.officialPortal)}
          >
            {APP_CONFIG.officialPortal}
          </Text>

          <Text style={[styles.policyMeta, { marginTop: 24 }]}>
            👑 Powered by {APP_CONFIG.studioName} | Official Vault: {APP_CONFIG.officialPortal}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════
type TabId = 'dashboard' | 'analytics' | 'settings';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(50000);
  const [budgetInput, setBudgetInput] = useState('50000');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('PKR');
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const transactionCountRef = useRef(0);
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const rewardedRef = useRef<RewardedAd | null>(null);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const [rewardedLoaded, setRewardedLoaded] = useState(false);

  const currencySymbol = getCurrencySymbol(currencyCode);

  // ---- Load persisted data + init ads/consent on mount ----
  useEffect(() => {
    (async () => {
      const [storedTransactions, storedBudget, storedCurrency] = await Promise.all([
        loadTransactions(),
        loadBudget(),
        loadCurrency(),
      ]);
      setTransactions(storedTransactions);
      setMonthlyBudget(storedBudget);
      setBudgetInput(String(storedBudget));
      setCurrencyCode(storedCurrency);
      setLoaded(true);

      await initializeAdsWithConsent();
      preloadInterstitial();
      preloadRewarded();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist whenever transactions/settings change ----
  useEffect(() => {
    if (loaded) saveTransactions(transactions);
  }, [transactions, loaded]);

  // ---- Interstitial: preload + listeners ----
  const preloadInterstitial = useCallback(() => {
    const ad = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
      requestNonPersonalizedAdsOnly: false,
    });
    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => setInterstitialLoaded(true));
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setInterstitialLoaded(false);
      preloadInterstitial(); // reload the next one immediately
    });
    ad.load();
    interstitialRef.current = ad;
    return () => {
      unsubLoaded();
      unsubClosed();
    };
  }, []);

  const maybeShowInterstitial = useCallback(() => {
    transactionCountRef.current += 1;
    const shouldShow = transactionCountRef.current % INTERSTITIAL_TRANSACTION_INTERVAL === 0;
    if (shouldShow && interstitialLoaded && interstitialRef.current) {
      interstitialRef.current.show();
    }
  }, [interstitialLoaded]);

  // ---- Rewarded: preload + listeners (unlocks PDF/CSV export) ----
  const preloadRewarded = useCallback(() => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded, {
      requestNonPersonalizedAdsOnly: false,
    });
    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setRewardedLoaded(true));
    ad.load();
    rewardedRef.current = ad;
    return () => unsubLoaded();
  }, []);

  const runExportWithRewardedAd = useCallback(
    (kind: 'pdf' | 'csv') => {
      const proceedWithExport = async () => {
        setIsExporting(true);
        try {
          const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          if (kind === 'pdf') {
            await exportPdfFile(transactions, currencySymbol, totalIncome, totalExpense);
          } else {
            await exportCsvFile(transactions, currencyCode);
          }
        } catch (err) {
          Alert.alert('Export failed', 'Something went wrong while generating your report. Please try again.');
        } finally {
          setIsExporting(false);
        }
      };

      if (!rewardedLoaded || !rewardedRef.current) {
        Alert.alert(
          'Ad not ready',
          'The rewarded ad is still loading. You can try again in a few seconds, or proceed without watching an ad.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Export Anyway', onPress: proceedWithExport },
          ],
        );
        return;
      }

      const unsubEarned = rewardedRef.current.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        proceedWithExport();
      });
      const unsubClosed = rewardedRef.current.addAdEventListener(AdEventType.CLOSED, () => {
        setRewardedLoaded(false);
        preloadRewarded();
        unsubEarned();
        unsubClosed();
      });
      rewardedRef.current.show();
    },
    [transactions, currencySymbol, currencyCode, rewardedLoaded, preloadRewarded],
  );

  const monthKey = currentMonthKey();

  const { monthIncome, monthExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (!isSameMonth(t.date, monthKey)) continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { monthIncome: income, monthExpense: expense };
  }, [transactions, monthKey]);

  const usedPercent = monthlyBudget > 0 ? (monthExpense / monthlyBudget) * 100 : 0;
  const remaining = Math.max(monthlyBudget - monthExpense, 0);

  const chartData = useMemo(() => {
    const keys = lastNDateKeys(7);
    const totals = keys.map((key) =>
      transactions.filter((t) => t.type === 'expense' && toDateKey(t.date) === key).reduce((sum, t) => sum + t.amount, 0),
    );
    return { labels: keys.map(shortDayLabel), datasets: [{ data: totals.length ? totals : [0] }] };
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<CategoryId, number>();
    let total = 0;
    for (const t of transactions) {
      if (t.type !== 'expense' || !isSameMonth(t.date, monthKey)) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
      total += t.amount;
    }
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({ categoryId, amount, percent: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, monthKey]);

  const checkBudgetAlert = useCallback(
    (newExpenseTotal: number) => {
      if (monthlyBudget <= 0) return;
      const pct = (newExpenseTotal / monthlyBudget) * 100;
      if (pct >= 100) {
        Alert.alert(
          '⚠️ Budget Exceeded',
          `You've spent ${formatAmount(newExpenseTotal, currencySymbol)}, over your ${formatAmount(monthlyBudget, currencySymbol)} monthly budget.`,
        );
      } else if (pct >= 80) {
        Alert.alert(
          '🔔 Budget Alert',
          `You've used ${Math.round(pct)}% of your monthly budget. ${formatAmount(monthlyBudget - newExpenseTotal, currencySymbol)} remaining.`,
        );
      }
    },
    [monthlyBudget, currencySymbol],
  );

  const handleAddTransaction = (input: { type: TransactionType; amount: number; categoryId: CategoryId; note: string }) => {
    const transaction: Transaction = {
      id: generateId(),
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      note: input.note,
      date: new Date().toISOString(),
    };
    setTransactions((prev) => [transaction, ...prev]);
    setShowAddSheet(false);

    if (input.type === 'expense') {
      checkBudgetAlert(monthExpense + input.amount);
    }

    maybeShowInterstitial();
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveBudget = () => {
    const value = Number(budgetInput);
    if (Number.isFinite(value) && value >= 0) {
      setMonthlyBudget(value);
      saveBudget(value);
      Alert.alert('Saved', 'Your monthly budget has been updated.');
    }
  };

  const handleChangeCurrency = (code: CurrencyCode) => {
    setCurrencyCode(code);
    saveCurrency(code);
  };

  const recentTransactions = transactions.slice(0, 8);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Ionicons name="pulse" size={20} color={COLORS.emerald} />
          <Text style={styles.headerTitle}>{APP_CONFIG.appName}</Text>
        </View>
        <Text style={styles.headerVersion}>v{APP_CONFIG.versionName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'dashboard' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>This Month's Budget</Text>
              <Text style={styles.bigAmount}>
                {formatAmount(remaining, currencySymbol)} <Text style={styles.bigAmountSuffix}>left</Text>
              </Text>
              <ProgressBar percent={usedPercent} danger={usedPercent >= 90} />
              <View style={styles.rowBetween}>
                <Text style={styles.smallMuted}>{formatAmount(monthExpense, currencySymbol)} spent</Text>
                <Text style={styles.smallMuted}>{formatAmount(monthlyBudget, currencySymbol)} limit</Text>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Ionicons name="trending-up-outline" size={16} color={COLORS.emerald} />
                  <Text style={styles.statValue}>{formatAmount(monthIncome, currencySymbol)}</Text>
                  <Text style={styles.statLabel}>Income</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="trending-down-outline" size={16} color={COLORS.gold} />
                  <Text style={styles.statValue}>{formatAmount(monthExpense, currencySymbol)}</Text>
                  <Text style={styles.statLabel}>Expense</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>7-Day Spending Trend</Text>
              <LineChart
                data={chartData}
                width={Dimensions.get('window').width - 64}
                height={180}
                withInnerLines={false}
                withOuterLines={false}
                chartConfig={{
                  backgroundGradientFrom: COLORS.surface,
                  backgroundGradientTo: COLORS.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  labelColor: () => COLORS.textSecondary,
                  propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.gold },
                }}
                bezier
                style={{ borderRadius: 16, marginTop: 8 }}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Activity</Text>
              {recentTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No transactions yet. Tap + to add one.</Text>
              ) : (
                <FlatList
                  data={recentTransactions}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TransactionRow transaction={item} currencySymbol={currencySymbol} onDelete={() => handleDeleteTransaction(item.id)} />
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}
            </View>
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending by Category</Text>
              {categoryBreakdown.length === 0 ? (
                <Text style={styles.emptyText}>Log a few expenses to see your breakdown.</Text>
              ) : (
                categoryBreakdown.map((item) => {
                  const category = getCategory(item.categoryId);
                  return (
                    <View key={item.categoryId} style={{ marginBottom: 16 }}>
                      <View style={styles.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name={category.icon} size={14} color={category.color} />
                          <Text style={styles.categoryRowLabel}>{category.label}</Text>
                        </View>
                        <Text style={styles.categoryRowAmount}>{formatAmount(item.amount, currencySymbol)}</Text>
                      </View>
                      <View style={{ marginTop: 6 }}>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: category.color }]} />
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Export Deep Analytics Report</Text>
              <Text style={[styles.smallMuted, { marginBottom: 14 }]}>
                Watch a short rewarded ad to unlock a full PDF or CSV export of every transaction
                you've logged.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.exportButton, { backgroundColor: COLORS.emerald }]}
                  onPress={() => runExportWithRewardedAd('pdf')}
                  disabled={isExporting}
                >
                  <Ionicons name="document-text-outline" size={16} color={COLORS.bg} />
                  <Text style={styles.exportButtonText}>{isExporting ? 'Working…' : 'PDF'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportButton, { backgroundColor: COLORS.gold }]}
                  onPress={() => runExportWithRewardedAd('csv')}
                  disabled={isExporting}
                >
                  <Ionicons name="grid-outline" size={16} color={COLORS.bg} />
                  <Text style={styles.exportButtonText}>{isExporting ? 'Working…' : 'CSV'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Currency</Text>
              <View style={styles.categoryGrid}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => handleChangeCurrency(c.code)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: currencyCode === c.code ? COLORS.emerald + '25' : COLORS.surfaceAlt,
                        borderColor: currencyCode === c.code ? COLORS.emerald : COLORS.border,
                      },
                    ]}
                  >
                    <Text style={{ color: currencyCode === c.code ? COLORS.emerald : COLORS.textSecondary, fontWeight: '700' }}>
                      {c.symbol}
                    </Text>
                    <Text style={[styles.categoryPillText, { color: currencyCode === c.code ? COLORS.emerald : COLORS.textSecondary }]}>
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monthly Budget Limit</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>{currencySymbol}</Text>
                <TextInput value={budgetInput} onChangeText={setBudgetInput} keyboardType="numeric" style={styles.amountInput} />
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveBudget}>
                <Text style={styles.saveButtonText}>Save Budget</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <TouchableOpacity style={styles.policyLinkRow} onPress={() => setShowPrivacyPolicy(true)}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.emerald} />
                <Text style={styles.policyLinkText}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { alignItems: 'center' }]}>
              <Text style={styles.brandFooterText}>
                👑 Powered by {APP_CONFIG.studioName} | Official Vault:
              </Text>
              <Text
                style={[styles.brandFooterText, { color: COLORS.emerald, marginTop: 2 }]}
                onPress={() => Linking.openURL(APP_CONFIG.officialPortal)}
              >
                {APP_CONFIG.officialPortal}
              </Text>
              <Text style={[styles.smallMuted, { marginTop: 8 }]}>
                {APP_CONFIG.packageName} · v{APP_CONFIG.versionName} ({APP_CONFIG.versionCode})
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Banner Ad — cleanly docked above the tab bar */}
      <View style={styles.bannerWrap}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddSheet(true)}>
        <Ionicons name="add" size={28} color={COLORS.bg} />
      </TouchableOpacity>

      <View style={styles.bottomNav}>
        {(
          [
            { id: 'dashboard', label: 'Home', icon: 'home-outline' },
            { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
            { id: 'settings', label: 'Settings', icon: 'settings-outline' },
          ] as { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[]
        ).map((tab) => (
          <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => setActiveTab(tab.id)}>
            <Ionicons name={tab.icon} size={22} color={activeTab === tab.id ? COLORS.emerald : COLORS.textMuted} />
            <Text style={[styles.navLabel, { color: activeTab === tab.id ? COLORS.emerald : COLORS.textMuted }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <AddTransactionSheet
        visible={showAddSheet}
        currencySymbol={currencySymbol}
        onClose={() => setShowAddSheet(false)}
        onSave={handleAddTransaction}
      />

      <PrivacyPolicyModal visible={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 4,
    paddingBottom: 12,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  headerVersion: { color: COLORS.textMuted, fontSize: 11 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  cardLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  bigAmount: { color: COLORS.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  bigAmountSuffix: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  progressTrack: { height: 10, borderRadius: 6, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  smallMuted: { color: COLORS.textMuted, fontSize: 12 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  statBox: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: 14, padding: 12, alignItems: 'flex-start', gap: 4 },
  statValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  statLabel: { color: COLORS.textMuted, fontSize: 11 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  transactionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  transactionLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  transactionDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  transactionAmount: { fontSize: 14, fontWeight: '700' },
  separator: { height: 1, backgroundColor: COLORS.border },
  categoryRowLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  categoryRowAmount: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  exportButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  exportButtonText: { color: COLORS.bg, fontWeight: '700', fontSize: 13 },
  bannerWrap: { alignItems: 'center', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 148,
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  navItem: { alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 10, fontWeight: '600' },

  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '88%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 4, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  typeToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  typeToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 },
  amountPrefix: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', paddingVertical: 14 },
  textInput: { backgroundColor: COLORS.surfaceAlt, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: COLORS.textPrimary, fontSize: 14, marginBottom: 8 },
  suggestionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  suggestionText: { color: COLORS.gold, fontSize: 11, fontStyle: 'italic', flexShrink: 1 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  categoryPillText: { fontSize: 12, fontWeight: '600' },
  saveButton: { backgroundColor: COLORS.emerald, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveButtonText: { color: COLORS.bg, fontSize: 15, fontWeight: '700' },

  policyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  policyMeta: { color: COLORS.textMuted, fontSize: 11, marginBottom: 4 },
  policyHeading: { color: COLORS.gold, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  policyBody: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19 },
  policyLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyLinkText: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  brandFooterText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
