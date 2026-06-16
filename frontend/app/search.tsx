// frontend/app/search.tsx  (or frontend/src/screens/Search.tsx)
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from "react-native";
import { useSearchTrainersQuery, useGetSpecializationsQuery, SearchParams, TrainerSearchItem } from "../features/trainer/trainerApiSlice";
import { useRouter } from "expo-router";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInUp, PressableScale } from "../src/components/ui";
import { useTourTarget } from "../src/components/onboarding/TourContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


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

  const { data: specializationsData } = useGetSpecializationsQuery();
  const specializationOptions = (specializationsData?.data ?? []).map((s) => ({
    id: String(s.id),
    label: s.name,
  }));

  const { data, isLoading, isFetching, isError } = useSearchTrainersQuery(
    Object.keys(activeParams).length > 0 ? activeParams : undefined
  );

  const trainers = data?.data?.trainers ?? [];
  const pagination = data?.data?.pagination;

  const buildParams = useCallback((): SearchParams => {
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
    return params;
  }, [query, city, state, minPrice, maxPrice, selectedSpecs, sortBy, sortOrder]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setActiveParams(buildParams());
  }, [buildParams]);

  // Live search: debounce committed params so results update as the user
  // types or adjusts filters, instead of only on keyboard submit / Apply.
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      setActiveParams(buildParams());
    }, 350);
    return () => clearTimeout(handle);
  }, [buildParams]);

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

  // Onboarding tour targets.
  const searchBarTourRef = useTourTarget("client-search-bar");
  const filtersTourRef = useTourTarget("client-filters");

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < full ? "star" : "star-outline"}
        size={12}
        color={i < full ? "#F59E0B" : theme.colors.border}
        style={{ marginRight: 2 }}
      />
    ));
  };

  const renderTrainerCard = ({ item, index }: { item: TrainerSearchItem; index: number }) => (
    <FadeInUp delay={Math.min(index, 8) * theme.motion.stagger}>
    <PressableScale
      style={styles.card}
      scaleTo={0.98}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View trainer ${item.user?.firstName ?? ""} ${item.user?.lastName ?? ""}`}
      onPress={() =>
        router.push({
          pathname: "/trainers/[id]",
          params: {
            id: String(item.id),
            firstName: item.user?.firstName ?? "",
            lastName: item.user?.lastName ?? "",
            profileImageUrl: item.user?.profileImageUrl ?? "",
            bio: item.bio ?? "",
            totalRating: String(Number(item.totalRating ?? 0)),
            reviewCount: String(item.reviewCount ?? 0),
            experienceYears: String(item.experienceYears ?? 0),
            hourlyRate: String(item.hourlyRate ?? 0),
            sessionRate: String(item.sessionRate ?? 0),
            isAvailableAtGym: item.isAvailable ? "1" : "0",
          },
        })
      }
    >
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
              <Ionicons name="star" size={10} color="#D97706" style={{marginRight: 2}} />
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
          <View style={styles.locationContainer}>
             <Ionicons name="location" size={12} color={theme.colors.textSecondary} />
             <Text style={styles.cardLocation}>
               {[item.locationCity, item.locationState].filter(Boolean).join(", ")}
             </Text>
          </View>
        )}
      </View>
    </PressableScale>
    </FadeInUp>
  );

  const renderEmpty = () => {
    if (isLoading || isFetching) return null;
    if (Object.keys(activeParams).length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={48} color={theme.colors.textSecondary} style={{ marginBottom: theme.spacing.md }} />
          <Text style={styles.emptyTitle}>Find your trainer</Text>
          <Text style={styles.emptyDesc}>Search by name, location, or specialization</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="sad-outline" size={48} color={theme.colors.textSecondary} style={{ marginBottom: theme.spacing.md }} />
        <Text style={styles.emptyTitle}>No trainers found</Text>
        <Text style={styles.emptyDesc}>Try adjusting your filters</Text>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClear}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Clear Filters"
        >
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
          <View ref={searchBarTourRef} collapsable={false} style={styles.searchBox}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
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
              <TouchableOpacity
                onPress={() => setQuery("")}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <View ref={filtersTourRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
              onPress={toggleFilters}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={showFilters ? "Hide filters" : "Show filters"}
            >
              <Ionicons name="options" size={24} color={showFilters ? "#FFFFFF" : theme.colors.text} />
            </TouchableOpacity>
          </View>
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
              {specializationOptions.map((s) => {
                const active = selectedSpecs.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.specPill, active && styles.specPillActive]}
                    onPress={() => toggleSpec(s.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${active ? "Remove" : "Add"} specialization ${s.label}`}
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
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort by ${opt.label}`}
                >
                  <Text style={[styles.sortChipText, sortBy === opt.value && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={handleClear}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Clear All filters"
              >
                <Text style={styles.clearFilterText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => { handleSearch(); toggleFilters(); }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Apply Filters"
              >
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
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Load More trainers"
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
      <TouchableOpacity
        onPress={onRemove}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Remove filter ${label}`}
      >
        <Ionicons name="close" size={14} color={theme.colors.primary} style={{marginLeft: 2}}/>
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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, ...typography.body1, color: theme.colors.text },
  filterToggle: {
    width: 48,
    height: 48,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.small,
  },
  filterToggleActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },

  // Filters panel
  filtersPanel: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  filterSection: {
    ...typography.body2,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  row: { flexDirection: "row" },
  filterInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body2,
    color: theme.colors.text,
  },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  specPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  specPillActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  specPillText: { ...typography.caption, color: theme.colors.textSecondary },
  specPillTextActive: { color: "#fff", fontWeight: "700" },
  sortRow: { marginBottom: theme.spacing.sm },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    backgroundColor: theme.colors.surface,
  },
  sortChipActive: { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}15` },
  sortChipText: { ...typography.caption, color: theme.colors.textSecondary },
  sortChipTextActive: { color: theme.colors.primary, fontWeight: "700" },
  filterActions: { flexDirection: "row", gap: 12, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  clearFilterBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  clearFilterText: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  applyBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },

  // Active chips
  activeChips: { marginTop: theme.spacing.xs },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${theme.colors.primary}15`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeChipText: { ...typography.caption, color: theme.colors.primary, fontWeight: "700" },

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
    ...theme.shadows.small,
  },
  cardLeft: { marginRight: theme.spacing.md, alignItems: "center" },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${theme.colors.primary}20`,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { ...typography.h3, color: theme.colors.primary, fontWeight: "700" },
  availableDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    marginTop: -8,
    marginLeft: 40,
    borderWidth: 2,
    borderColor: "#fff",
  },
  cardBody: { flex: 1, justifyContent: 'center' },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { ...typography.h3, color: theme.colors.text, fontWeight: "700", fontSize: 16 },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  featuredText: { fontSize: 10, color: "#92400E", fontWeight: "700", textTransform: 'uppercase' },
  cardBio: { ...typography.body2, color: theme.colors.textSecondary, marginBottom: 8 },
  specRow: { marginBottom: 8 },
  specChip: {
    backgroundColor: `${theme.colors.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  specChipText: { fontSize: 11, color: theme.colors.primary, fontWeight: "700", textTransform: 'uppercase' },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  ratingCount: { ...typography.caption, color: theme.colors.textSecondary, marginLeft: 6, textTransform: 'none' },
  cardPrice: { ...typography.body1, fontWeight: "800", color: theme.colors.primary },
  locationContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2},
  cardLocation: { ...typography.caption, color: theme.colors.textSecondary, marginLeft: 4, textTransform: 'none' },

  // States
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, marginTop: 40 },
  loadingText: { ...typography.body2, color: theme.colors.textSecondary },
  emptyState: { flex: 1, alignItems: "center", paddingTop: 80 },
  emptyTitle: { ...typography.h3, color: theme.colors.text, marginBottom: theme.spacing.xs },
  emptyDesc: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  clearBtn: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.roundness,
    ...theme.shadows.medium,
  },
  clearBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  loadMoreBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  loadMoreText: { ...typography.body2, color: theme.colors.primary, fontWeight: "700" },
});
