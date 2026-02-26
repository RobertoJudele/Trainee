import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSearchTrainerQuery } from '../../features/trainer/trainerApiSlice';
import { useSelector } from 'react-redux';
import { selectCurrentToken, selectCurrentUser } from '../../features/auth/authSlice';
import { theme, typography } from '../lib/theme';

const { width } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);
  const token= useSelector(selectCurrentToken);
  console.log("👤 Current token in Home:", token);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: trainers,
    isLoading,
    isSuccess,
    isError,
    error,
    refetch,
  } = useSearchTrainerQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // const filteredTrainers = trainers?.filter((trainer: any) =>
  //   trainer.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //   trainer.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //   trainer.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  // ) || [];

  const renderTrainerCard = ({ item: trainer }: { item: any }) => (
    <TouchableOpacity 
      style={styles.trainerCard}
      onPress={() => router.push(`/TrainerProfile?id=${trainer.id}`)}
    >
      <View style={styles.trainerAvatar}>
        <Text style={styles.trainerInitials}>
          {trainer.user?.firstName?.[0]}{trainer.user?.lastName?.[0]}
        </Text>
      </View>
      
      <View style={styles.trainerInfo}>
        <Text style={styles.trainerName}>
          {trainer.user?.firstName} {trainer.user?.lastName}
        </Text>
        <Text style={styles.trainerBio} numberOfLines={2}>
          {trainer.bio || 'Professional fitness trainer'}
        </Text>
        <View style={styles.trainerMeta}>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingIcon}>⭐</Text>
            <Text style={styles.rating}>{trainer.totalRating || '0.0'}</Text>
            <Text style={styles.reviewCount}>({trainer.reviewCount || 0})</Text>
          </View>
          <Text style={styles.hourlyRate}>
            ${trainer.hourlyRate || '0'}/hr
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/trainersIndex')}
        >
          <Text style={styles.actionIcon}>🔍</Text>
          <Text style={styles.actionTitle}>Find Trainers</Text>
          <Text style={styles.actionDesc}>Browse all trainers</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/create-trainer')}
        >
          <Text style={styles.actionIcon}>💼</Text>
          <Text style={styles.actionTitle}>Become Trainer</Text>
          <Text style={styles.actionDesc}>Start your journey</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/TrainerProfile')}
        >
          <Text style={styles.actionIcon}>👤</Text>
          <Text style={styles.actionTitle}>My Profile</Text>
          <Text style={styles.actionDesc}>View trainer profile</Text>
        </TouchableOpacity>

      </View>
    </View>
  );


  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>
            {user?.firstName ? `${user.firstName}!` : 'Welcome!'}
          </Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Pressable onPress={() => router.push('/TrainerProfile')}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>
                {user?.firstName?.[0] || 'U'}
              </Text>
            </View>
          </Pressable>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
      </View>

      {/* Quick Actions */}
      {renderQuickActions()}

      {/* Featured Trainers */}
      {/* <View style={styles.trainersSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Trainers</Text>
          <TouchableOpacity onPress={() => router.push('/trainersIndex')}>
            <Text style={styles.seeAllButton}>See All</Text>
          </TouchableOpacity>
        </View>

        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Finding trainers...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>😞</Text>
            <Text style={styles.errorText}>Unable to load trainers</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredTrainers.length > 0 ? (
          <FlatList
            data={filteredTrainers.slice(0, 5)}
            renderItem={renderTrainerCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyText}>No trainers found</Text>
            <Text style={styles.emptyDesc}>Try adjusting your search</Text>
          </View>
        )}
      </View> */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  greeting: {
    ...typography.body1,
    color: theme.colors.textSecondary,
  },
  userName: {
    ...typography.h2,
    color: theme.colors.text,
    fontWeight: '700',
  },
  profileButton: {
    padding: theme.spacing.xs,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body1,
    color: theme.colors.text,
  },
  quickActions: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actionCard: {
    width: (width - theme.spacing.lg * 2 - theme.spacing.sm) / 2,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  actionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  actionDesc: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  trainersSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  seeAllButton: {
    ...typography.body2,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  trainerCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  trainerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  trainerInitials: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    ...typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  trainerBio: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  trainerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingIcon: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  rating: {
    ...typography.body2,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: theme.spacing.xs,
  },
  reviewCount: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  hourlyRate: {
    ...typography.body2,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  cardSeparator: {
    height: theme.spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    ...typography.body1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.roundness,
    marginTop: theme.spacing.sm,
  },
  retryButtonText: {
    ...typography.body2,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...typography.body1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  emptyDesc: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
