import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  Alert,
  Dimensions,
  RefreshControl,
  Platform,
  SafeAreaView,
  TouchableOpacity
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import { fetchAtributes } from '../redux/action/userActions';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { createTheme, RFValue, RW, RH, getResponsivePadding } from '../utils/theme';
import ShimmerEffect from '../components/ShimmerEffect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;

const Liked = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isDarkMode = useSelector((state: any) => state.theme.isDarkMode);
  const theme = createTheme(isDarkMode);
  const likedInfo = useSelector((state: any) => state.user.likes);
  const userInfo = useSelector((state: any) => state.user.userinfo);

  const [likedArticles, setLikedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const insets = useSafeAreaInsets(); // ✅ safe area insets

  useEffect(() => {
    dispatch(fetchAtributes() as any);
  }, [dispatch]);

  const fetchLikedArticles = async () => {
    try {
      setLoading(true);
      if (!likedInfo || likedInfo.length === 0) {
        setLikedArticles([]);
        return;
      }

      const chunks = [];
      for (let i = 0; i < likedInfo.length; i += 10) {
        chunks.push(likedInfo.slice(i, i + 10));
      }

      let fetchedArticles: any[] = [];
      for (const chunk of chunks) {
        const snapshot = await firestore()
          .collection('crypto_articles_test_2')
          .where(firestore.FieldPath.documentId(), 'in', chunk)
          .get();

        const chunkArticles = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        fetchedArticles = [...fetchedArticles, ...chunkArticles];
      }

      const sorted = likedInfo
        .map((id: string) => fetchedArticles.find(article => article.id === id))
        .filter(Boolean);

      setLikedArticles(sorted);
    } catch (error) {
      console.error('Error fetching liked articles:', error);
      Alert.alert('Error', 'Could not load liked articles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLikedArticles();
  }, [likedInfo]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchAtributes() as any);
    await fetchLikedArticles();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.articleItem}>
      <View style={styles.articleImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.articleImage} />
        ) : (
          
           <View style={[styles.articleImagePlaceholder, { backgroundColor: theme.background }]}>
              <Image source={require('../assets/Logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
          
        )}
      </View>

      <TouchableOpacity
        style={styles.articleContent}
        onPress={() =>
          navigation.navigate('Home', {
            screen: 'Discover',
            articleId: item.id || null,
          })
        }
      >
        <Text style={[styles.articleText, { color: theme.text }]} numberOfLines={3}>
          {item.title || item.title}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.containerSaved, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View
          style={[
            styles.headerSaved,
            {
              backgroundColor: theme.card,
              borderBottomColor: theme.border,
              marginTop:insets.top + RH(5), // ✅ safe top padding
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButtonSaved}
            onPress={() => navigation.navigate('Home', { screen: 'ProfilePage' })}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={isTablet ? 32 : 35}
              color={theme.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Saved Stories</Text>
          <Text style={[styles.headerCount, { color: theme.textSecondary }]}>
            ({likedArticles.length.toString().padStart(2, '0')})
          </Text>
        </View>

        {/* Content List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3, 4, 5,6,7,8].map((index) => (
              <View key={index} style={[styles.shimmerArticleItem]}>
                <ShimmerEffect
                  width={isTablet ? RW(120) : RW(80)}
                  height={isTablet ? RW(120) : RW(80)}
                  borderRadius={RW(8)}
                  style={styles.shimmerArticleImage}
                />
                <View style={styles.shimmerArticleContent}>
                  <ShimmerEffect width="100%" height={RH(16)} borderRadius={RW(4)} style={styles.shimmerArticleText} />
                  <ShimmerEffect width="90%" height={RH(16)} borderRadius={RW(4)} style={styles.shimmerArticleText} />
                  <ShimmerEffect width="80%" height={RH(16)} borderRadius={RW(4)} style={styles.shimmerArticleText} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={likedArticles}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + RH(20) }]} // ✅ safe bottom padding
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
                title="Pull to refresh"
                titleColor={theme.textSecondary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="bookmark-outline"
                  size={RFValue(isTablet ? 120 : 80)}
                  color={theme.textLight}
                />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Saved Stories</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {likedInfo && likedInfo.length === 0
                    ? 'Start saving articles to see them here!'
                    : 'Loading failed. Pull down to refresh.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default Liked;

const styles = StyleSheet.create({
  containerSaved: {
    flex: 1,
  },
  headerSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: RH(0),
    paddingVertical: RH(8),
    borderBottomWidth: 1,
  },
  backButtonSaved: {
    width: isTablet ? RW(40) : RW(40),
    height: isTablet ? RW(40) : RW(35),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: RFValue(isTablet ? 24 : 22),
    marginLeft: RW(5),
    fontFamily:"Lato-Regular",
    fontWeight:"500"
  },
  headerCount: {
    fontSize: RFValue(isTablet ? 16 : 14),
    marginLeft: RW(8),
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal:20,
    paddingTop: RH(5),
    paddingBottom: RH(32),
  },
  shimmerArticleItem: {
    flexDirection: 'row',
    paddingVertical: RH(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  shimmerArticleImage: { marginRight: RW(16) },
  shimmerArticleContent: { flex: 1, justifyContent: 'center' },
  shimmerArticleText: { marginBottom: RH(8) },
  listContainer: {
    paddingHorizontal: getResponsivePadding(),
    paddingTop: RH(16),
  },
  articleItem: {
    flexDirection: 'row',
    paddingVertical: RH(10),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginHorizontal: 20,
  },
  articleImageContainer: { marginRight: RW(16) },
  articleImage: {
    width: isTablet ? RW(120) : RW(80),
    height: isTablet ? RW(120) : RW(80),
    borderRadius: RW(8),
    backgroundColor: '#F0F0F0',
  },
  articleImagePlaceholder: {
    width: isTablet ? RW(120) : RW(80),
    height: isTablet ? RW(120) : RW(80),
    borderRadius: RW(8),
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo:{
    height:"100%",
    width:"100%"
  },
  
  articleContent: { flex: 1, justifyContent: 'center' },
  articleText: {
    fontSize: RFValue(isTablet ? 20 : 16),
    lineHeight: RFValue(isTablet ? 24 : 20),
    fontFamily:"Lato-Regular",
    fontWeight:"400"
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(),
    paddingTop: RH(60),
    minHeight: SCREEN_HEIGHT * 0.6,
  },
  emptyTitle: {
    fontSize: RFValue(isTablet ? 28 : 24),
    fontWeight: '700',
    marginTop: RH(16),
    marginBottom: RH(8),
  },
  emptyText: { fontSize: RFValue(isTablet ? 18 : 16), textAlign: 'center' },
});
