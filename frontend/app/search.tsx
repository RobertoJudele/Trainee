// frontend/app/search.tsx  (or frontend/src/screens/Search.tsx)
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from "react-native";
import { useSearchTrainersQuery, SearchParams, TrainerSearchItem } from "../features/trainer/trainerApiSlice";
import { useRouter } from "expo-router";
import { theme, typography } from "../src/lib/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SPECIALIZATION_OPTIONS = [
  { id: "1", label: "Yoga" },
  { id: "2", label: "CrossFit" },
  { id: "3", label: "Personal Training" },
  { id: "4", label: "Pilates" },
  { id: "5", label: "Nutrition" },
  { id: "6", label: "Strength" },
  { id: "7", label: "Cardio" },
  { id: "8", label: "Martial Arts" },
];

const SORT_OPTIONS = [
  { value: "totalRating", label: "Top Rated" },
  { value: "reviewCount", label: "Most Reviewed" },
  { value: "hourlyRate", label: "Price: Low to High" },
  { value: "experienceYears", label: "Most Experienced" },
  { value: "createdAt", label: "Newest" },
] as const;

export default function SearchScreen() {
  const router = useRouter();

  // --- search state ---
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SearchParams["sortBy"]>("totalRating");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Committed search params (only update when user taps Search)
  const [activeParams, setActiveParams] = useState<SearchParams>({});

  const { data, isLoading, isFetching, isError } = useSearchTrainersQuery(
    Object.keys(activeParams).length > 0 ? activeParams : undefined
  );

  const trainers = data?.data?.trainers ?? [];
  const pagination = data?.data?.pagination;

  const handleSearch = useCallback(() => {
    const params: SearchParams = {};
    if (query.trim()) params.q = query.trim();
    if (city.trim()) params.city = city.trim();
    if (state.trim()) params.state = state.trim();
    if (minPrice) params.minRate = parseFloat(minPrice);
    if (maxPrice) params.maxRate = parseFloat(maxPrice);
    if (selectedSpecs.length > 0) params.specializations = selectedSpecs.join(",");
    if (sortBy) params.sortBy = sortBy;
    params.sortOrder = sortOrder;
    params.page = 1;
    params.limit = 20;
    setPage(1);
    setActiveParams(params);
  }, [query, city, state, minPrice, maxPrice, selectedSpecs, sortBy, sortOrder]);

  const handleClear = useCallback(() => {
    setQuery("");
    setCity("");
    setState("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedSpecs([]);
    setSortBy("totalRating");
    setSortOrder("desc");
    setActiveParams({});
    setPage(1);
  }, []);

  const toggleSpec = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedSpecs((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const toggleFilters = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFilters((v) => !v);
  }, []);

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    return Array.from({ length: 5 }, (_, i) => (
      <Text key={i} style={i < full ? styles.starFull : styles.starEmpty}>
        ★
      </Text>
    ));
  };

  const renderTrainerCard = ({ item }: { item: TrainerSearchItem }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85}>
      {/* Avatar */}
      <View style={styles.cardLeft}>
        {item.user?.profileImageUrl ? (
          <Image source={{ uri: item.user.profileImageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {item.user?.firstName?.[0] ?? ""}
              {item.user?.lastName?.[0] ?? ""}
            </Text>
          </View>
        )}
        {item.isAvailable && <View style={styles.availableDot} />}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>
            {item.user?.firstName} {item.user?.lastName}
          </Text>
          {item.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
        </View>

        {item.bio ? (
          <Text style={styles.cardBio} numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}

        {/* Specializations */}
        {item.specializations?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specRow}>
            {item.specializations.slice(0, 4).map((s) => (
              <View key={s.id} style={styles.specChip}>
                <Text style={styles.specChipText}>{s.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Meta row */}
        <View style={styles.cardMeta}>
          <View style={styles.ratingRow}>
            {renderStars(Number(item.totalRating ?? 0))}
            <Text style={styles.ratingCount}>({item.reviewCount})</Text>
          </View>
          <Text style={styles.cardPrice}>
            {item.hourlyRate ? `$${item.hourlyRate}/hr` : item.sessionRate ? `$${item.sessionRate}/ses` : "—"}
          </Text>
        </View>

        {/* Location */}
        {(item.locationCity || item.locationState) && (
          <Text style={styles.cardLocation}>
            📍 {[item.locationCity, item.locationState].filter(Boolean).join(", ")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading || isFetching) return null;
    if (Object.keys(activeParams).length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Find your trainer</Text>
          <Text style={styles.emptyDesc}>Search by name, location, or specialization</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>😕</Text>
        <Text style={styles.emptyTitle}>No trainers found</Text>
        <Text style={styles.emptyDesc}>Try adjusting your filters</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Clear Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Search bar ── */}
      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search trainers..."
              placeholderTextColor={theme.colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Text style={styles.clearX}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
            onPress={toggleFilters}
          >
            <Text style={styles.filterToggleIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Filters panel ── */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterSection}>Location</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.filterInput, { flex: 1, marginRight: 8 }]}
                placeholder="City"
                placeholderTextColor={theme.colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={[styles.filterInput, { flex: 1 }]}
                placeholder="State"
                placeholderTextColor={theme.colors.textSecondary}
                value={state}
                onChangeText={setState}
              />
            </View>

            <Text style={styles.filterSection}>Price Range (per session)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.filterInput, { flex: 1, marginRight: 8 }]}
                placeholder="Min $"
                placeholderTextColor={theme.colors.textSecondary}
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.filterInput, { flex: 1 }]}
                placeholder="Max $"
                placeholderTextColor={theme.colors.textSecondary}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.filterSection}>Specializations</Text>
            <View style={styles.specGrid}>
              {SPECIALIZATION_OPTIONS.map((s) => {
                const active = selectedSpecs.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.specPill, active && styles.specPillActive]}
                    onPress={() => toggleSpec(s.id)}
                  >
                    <Text style={[styles.specPillText, active && styles.specPillTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterSection}>Sort By</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
                  onPress={() => setSortBy(opt.value as SearchParams["sortBy"])}
                >
                  <Text style={[styles.sortChipText, sortBy === opt.value && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.clearFilterBtn} onPress={handleClear}>
                <Text style={styles.clearFilterText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => { handleSearch(); toggleFilters(); }}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Active filter chips */}
        {Object.keys(activeParams).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChips}>
            {activeParams.q && <ActiveChip label={`"${activeParams.q}"`} onRemove={() => { setQuery(""); setActiveParams(p => { const n = {...p}; delete n.q; return n; }); }} />}
            {activeParams.city && <ActiveChip label={activeParams.city} onRemove={() => { setCity(""); setActiveParams(p => { const n = {...p}; delete n.city; return n; }); }} />}
            {activeParams.state && <ActiveChip label={activeParams.state} onRemove={() => { setState(""); setActiveParams(p => { const n = {...p}; delete n.state; return n; }); }} />}
            {(activeParams.minRate || activeParams.maxRate) && (
              <ActiveChip
                label={`$${activeParams.minRate ?? 0}–$${activeParams.maxRate ?? "∞"}`}
                onRemove={() => { setMinPrice(""); setMaxPrice(""); setActiveParams(p => { const n = {...p}; delete n.minRate; delete n.maxRate; return n; }); }}
              />
            )}
            {activeParams.specializations && (
              <ActiveChip
                label={`${activeParams.specializations.split(",").length} specialization(s)`}
                onRemove={() => { setSelectedSpecs([]); setActiveParams(p => { const n = {...p}; delete n.specializations; return n; }); }}
              />
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Results ── */}
      {(isLoading || isFetching) ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Finding trainers...</Text>
        </View>
      ) : (
        <FlatList
          data={trainers}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderTrainerCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            pagination && pagination.total > 0 ? (
              <Text style={styles.resultCount}>{pagination.total} trainer{pagination.total !== 1 ? "s" : ""} found</Text>
            ) : null
          }
          ListFooterComponent={
            pagination?.hasNextPage ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  setActiveParams(p => ({ ...p, page: nextPage }));
                }}
              >
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.activeChip}>
      <Text style={styles.activeChipText}>{label}</Text>
      <TouchableOpacity onPress={onRemove}>
        <Text style={styles.activeChipX}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Top bar
  topBar: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: theme.spacing.sm },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, ...typography.body1, color: theme.colors.text },
  clearX: { fontSize: 14, color: theme.colors.textSecondary, paddingLeft: 8 },
  filterToggle: {
    width: 46,
    height: 46,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  filterToggleActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterToggleIcon: { fontSize: 18 },

  // Filters panel
  filtersPanel: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  filterSection: {
    ...typography.body2,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  row: { flexDirection: "row" },
  filterInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...typography.body2,
    color: theme.colors.text,
  },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  specPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  specPillActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  specPillText: { ...typography.caption, color: theme.colors.text },
  specPillTextActive: { color: "#fff", fontWeight: "600" },
  sortRow: { marginBottom: theme.spacing.sm },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    backgroundColor: theme.colors.background,
  },
  sortChipActive: { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}15` },
  sortChipText: { ...typography.caption, color: theme.colors.textSecondary },
  sortChipTextActive: { color: theme.colors.primary, fontWeight: "600" },
  filterActions: { flexDirection: "row", gap: 12, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  clearFilterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  clearFilterText: { ...typography.body2, color: theme.colors.text },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  applyBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },

  // Active chips
  activeChips: { marginTop: theme.spacing.xs },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    gap: 6,
  },
  activeChipText: { ...typography.caption, color: theme.colors.primary, fontWeight: "600" },
  activeChipX: { fontSize: 10, color: theme.colors.primary },

  // List
  listContent: { padding: theme.spacing.md, paddingBottom: 40 },
  resultCount: { ...typography.body2, color: theme.colors.textSecondary, marginBottom: theme.spacing.md },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: { marginRight: theme.spacing.md, alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { ...typography.h3, color: "#fff", fontWeight: "700" },
  availableDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  cardName: { ...typography.h3, color: theme.colors.text, fontWeight: "700", fontSize: 15 },
  featuredBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  featuredText: { fontSize: 10, color: "#92400E", fontWeight: "700" },
  cardBio: { ...typography.body2, color: theme.colors.textSecondary, marginBottom: 6 },
  specRow: { marginBottom: 6 },
  specChip: {
    backgroundColor: `${theme.colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 4,
  },
  specChipText: { fontSize: 11, color: theme.colors.primary, fontWeight: "600" },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  starFull: { fontSize: 12, color: "#F59E0B" },
  starEmpty: { fontSize: 12, color: theme.colors.border },
  ratingCount: { ...typography.caption, color: theme.colors.textSecondary, marginLeft: 4 },
  cardPrice: { ...typography.body2, fontWeight: "700", color: theme.colors.primary },
  cardLocation: { ...typography.caption, color: theme.colors.textSecondary, marginTop: 2 },

  // States
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { ...typography.body2, color: theme.colors.textSecondary },
  emptyState: { flex: 1, alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { ...typography.h3, color: theme.colors.text, marginBottom: theme.spacing.xs },
  emptyDesc: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  clearBtn: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.roundness,
  },
  clearBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  loadMoreBtn: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    marginTop: theme.spacing.sm,
  },
  loadMoreText: { ...typography.body2, color: theme.colors.primary, fontWeight: "600" },
});
