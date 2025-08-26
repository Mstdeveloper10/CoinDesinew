import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  FlatList,
  TouchableOpacity,
  Share,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import { fetchAtributes, fetchNewsList, fetchAllArticles } from '../redux/action/userActions';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
  Layout, FadeInDown, FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
  useAnimatedGestureHandler,
} from 'react-native-reanimated';
import ShimmerEffect from '../components/ShimmerEffect';
import Button from '../components/Button';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { createTheme, RFValue, getResponsivePadding, getResponsiveMargin, getStatusBarHeight, getResponsiveSize } from '../utils/theme';
import LoginPrompt from '../components/LoginPrompt';
import NetworkPopup from '../components/NetworkPopup';
import { format } from 'date-fns';
import Home from './Home';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import BookmarkPopup from '../components/BookmarkPopup';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNavigationMode } from 'react-native-navigation-mode';

import { isGestureNavigation } from 'react-native-navigation-mode';
import { NativeModules } from "react-native";





import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
const RW = val => wp((val / 375) * 100); // assuming 375px base width
const RH = val => hp((val / 812) * 100); // assuming 812px base height
const isTablet = RW >= 768;


interface NewsItem {
  id: string;
  title: string;
  summary: string;
  image?: string;
  url?: string;
  publishedAt?: string;
  source?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  timestamp?: string;
  article_link?: string;
}

// Image component with loading state
const ImageWithLoader = ({ uri, style, onLoad, onError }: {
  uri: string;
  style: any;
  onLoad?: () => void;
  onError?: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isDarkMode = useSelector((state: any) => state.theme.isDarkMode);
  const theme = createTheme(isDarkMode);



  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  return (
    <View style={style}>
      {isLoading && (
        <View style={[style, styles.imageLoader, { backgroundColor: theme.background, }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
      <Image
        source={{ uri }}
        style={[style, isLoading && styles.hiddenImage]}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
      {hasError && (
        <View style={[style, styles.imageError, { backgroundColor: theme.background }]}>
          <Ionicons name="image-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.imageErrorText, { color: theme.textSecondary, }]}>Failed to load image</Text>
        </View>
      )}
    </View>
  );
};

const DiscoverScreens = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation()
  const reduxNewsList = useSelector((state: any) => state.user.newsList);
  const userinfo = useSelector((state: any) => state.user.userinfo);
  const route = useRoute();

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [swipedItems, setSwipedItems] = useState<string[]>([]);
  const [likedItems, setLikedItems] = useState<string[]>([]);
  const [bookmarkedItems, setBookmarkedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [filteredNewsList, setFilteredNewsList] = useState<NewsItem[]>([]);
  const [bullishCounts, setBullishCounts] = useState<{ [key: string]: number }>({});
  const [bearishCounts, setBearishCounts] = useState<{ [key: string]: number }>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState<{ [key: string]: boolean }>({});
  const { articleId } = (route.params as { articleId?: string }) || {}; console.log(articleId)
  const isDarkMode = useSelector((state: any) => state.theme.isDarkMode);
  const theme = createTheme(isDarkMode);
  const [votedItems, setVotedItems] = useState<{ [key: string]: 'bullish' | 'bearish' | null }>({});
  const [Bookmarkpop, setBookmarkpop] = useState(false)

  const [bullishPercentage, setBullishPercentage] = useState<{ [key: string]: number }>({});
  const [bearishPercentage, setBearishPercentage] = useState<{ [key: string]: number }>({});
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'bullish' | 'bearish' | null }>({});

  // Animation values for simple fade transition
  const fadeOpacity = useSharedValue(1);
  const cardTranslateY = useSharedValue(0);
  const isTransitioning = useSharedValue(false);
  const [articleData, setArticleData] = useState<NewsItem | null>(null);
  // Login popup state
  const [showScrollLoginPrompt, setShowScrollLoginPrompt] = useState(false);
  const [hasShownLoginPrompt, setHasShownLoginPrompt] = useState(false);

  // Network connectivity state
  const [isNetworkConnected, setIsNetworkConnected] = useState(true);
  const [showNetworkPopup, setShowNetworkPopup] = useState(false);
  const insets = useSafeAreaInsets();
  console.log(insets)
  const [navigationMode, setNavigationMode] = useState(null);
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [isInitialLoadingSearch, setisInitialLoadingSearch] = useState(false)

  useEffect(() => {
    const checkNavMode = async () => {
      try {
        const navMode = await getNavigationMode();
        console.log("navemode", navMode);
        setNavigationMode(navMode.type);
      } catch (error) {
        console.error('Failed to get navigation mode:', error);
        // Fallback: assume 3-button if detection fails
      }
    };

    if (Platform.OS === 'android') {
      checkNavMode();
    }
  }, []);

  const isIphoneX = Platform.OS === 'ios' && (Dimensions.get('window').height > 800 || Dimensions.get('window').width > 800);
  console.log(isIphoneX)
  const BOTTOM_NAV_HEIGHT_IOS = isIphoneX ? 34 : 0;
  const BOTTOM_NAV_HEIGHT_ANDROID = RH(1); // A common value, but not reliable




  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [hasScrolledToArticle, setHasScrolledToArticle] = useState(false);
  const [isFetching, setIsFetching] = useState(false);



  // 1️⃣ Fetch Redux news list (only first mount OR no internet)
  useEffect(() => {
    const fetchNews = async () => {
      if (!isNetworkConnected) {
        if (!hasFetchedOnce) setIsInitialLoading(true);
        setShowNetworkPopup(true);
        return;
      }

      if (hasFetchedOnce) return;

      if (reduxNewsList.length === 0) setIsInitialLoading(true);
      else setIsFetching(true);

      if (userinfo?.uid) {
        await dispatch(fetchNewsList() as any);
      } else {
        await dispatch(fetchAllArticles() as any);
      }

      setIsInitialLoading(false);
      setIsFetching(false);
      setHasFetchedOnce(true);
    };

    fetchNews();
  }, [dispatch, userinfo, isNetworkConnected, hasFetchedOnce]);

  // ✅ 2. Fetch single article if opened via notification
  useEffect(() => {
    const fetchArticle = async () => {
      if (!articleId) return;

      setIsInitialLoading(true);

      try {
        const docSnap = await firestore()
          .collection('crypto_articles_test_2')
          .doc(articleId)
          .get();

        if (docSnap.exists) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setArticleData(data);
        } else {
          console.warn(`Article ${articleId} not found`);
        }
      } catch (err) {
        console.error('Error fetching article:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  // ✅ 3. Merge redux news + pinned article
  useEffect(() => {
    if (!reduxNewsList) return;


    let mergedList = [...reduxNewsList];

    if (articleData) {
      // remove duplicate
      mergedList = mergedList.filter(item => item.id !== articleData.id);
      // put notification article on top
      mergedList.unshift(articleData);
    }

    // sort the rest (keep first item fixed if notification article exists)
    if (mergedList.length > 1) {
      const pinned = articleData ? mergedList[0] : null;
      const rest = articleData ? mergedList.slice(1) : mergedList;

      rest.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      mergedList = pinned ? [pinned, ...rest] : rest;
    }

    setNewsList(mergedList);
    setFilteredNewsList(mergedList);
  }, [reduxNewsList, articleData]);

  // ✅ 4. Scroll to notification article (always index 0 if exists)
  useFocusEffect(
    React.useCallback(() => {
      if (!articleId || hasScrolledToArticle) return;

      if (filteredNewsList.length > 0) {
        setCurrentCardIndex(0); // always top card
        setHasScrolledToArticle(true);
      }
    }, [articleId, filteredNewsList, hasScrolledToArticle])
  );

  // ✅ 5. Reset if user logs out
  useEffect(() => {
    if (!userinfo?.uid) {
      setHasFetchedOnce(false);
      setNewsList([]);
      setFilteredNewsList([]);
      setArticleData(null);
      setHasScrolledToArticle(false);
    }
  }, [userinfo]);



  // Network connectivity check
  const checkNetworkConnectivity = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsNetworkConnected(true);
        setShowNetworkPopup(false);
      } else {
        setIsNetworkConnected(false);
        setShowNetworkPopup(true);
      }
    } catch (error) {
      setIsNetworkConnected(false);
      setShowNetworkPopup(true);
    }
  };

  // Check network connectivity periodically and on mount
  useEffect(() => {
    checkNetworkConnectivity();

    const networkCheckInterval = setInterval(checkNetworkConnectivity, 10000); // Check every 10 seconds

    return () => clearInterval(networkCheckInterval);
  }, []);



  useEffect(() => {
    const fetchAndFilter = async () => {
      if (searchQuery.trim() === '') {
        setFilteredNewsList(newsList); // reset list
        return;
      }
      setisInitialLoadingSearch(true)



      if (!isNetworkConnected) {
        setShowNetworkPopup(true);
        return;
      }

      try {
        // Get ALL documents from the collection
        const snapshot = await firestore()
          .collection('crypto_articles_test_2')
          .get();

        // Convert docs into array
        const newsListData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Apply filter
        const filtered = newsListData.filter((item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.source && item.source.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        setFilteredNewsList(filtered);
        setisInitialLoadingSearch(false)
      } catch (err) {
        console.error("Error fetching articles: ", err);
      }
    };

    fetchAndFilter();
  }, [searchQuery, isNetworkConnected]);  // no need for tempSearchQuery or newsList here

  // ✅ Input handler
  const handleTextChange = (text) => {
    setTempSearchQuery(text);

    if (text.trim() === '') {
      setSearchQuery(''); // reset search immediately
    }
  };

  // ✅ Trigger search on Enter
  const handleSearch = () => {
    setSearchQuery(tempSearchQuery);
  };


  const updateUserFirestoreArray = async (field: 'liked' | 'bookmarked' | 'history', itemId: string) => {
    if (!userinfo || !userinfo.uid) return;
    try {
      await firestore()
        .collection('users')
        .doc(userinfo.uid)
        .set({ [field]: firestore.FieldValue.arrayUnion(itemId) }, { merge: true });
    } catch (error) {
      console.error(`Failed to update ${field}`, error);
      Alert.alert("Error", `Failed to update ${field}`);
    }
  };

  const updateSentimentCollection = async (sentiment: 'bullish' | 'bearish', itemId: string) => {
    if (!userinfo || !userinfo.uid) return;

    try {
      // Check if user already voted for the opposite sentiment
      const oppositeSentiment = sentiment === 'bullish' ? 'bearish' : 'bullish';
      const oppositeDoc = await firestore()
        .collection(oppositeSentiment)
        .doc(itemId)
        .get();

      // Remove user from opposite sentiment if they voted there
      if (oppositeDoc.exists() && oppositeDoc.data()?.uids && oppositeDoc.data()?.uids.includes(userinfo.uid)) {
        await firestore()
          .collection(oppositeSentiment)
          .doc(itemId)
          .update({
            uids: firestore.FieldValue.arrayRemove(userinfo.uid),
            updatedAt: firestore.FieldValue.serverTimestamp()
          });
      }

      // Add user to selected sentiment
      await firestore()
        .collection(sentiment)
        .doc(itemId)
        .set({
          uids: firestore.FieldValue.arrayUnion(userinfo.uid),
          updatedAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      // Update local state
      setUserVotes(prev => ({ ...prev, [itemId]: sentiment }));
      setVotedItems(prev => ({ ...prev, [itemId]: sentiment }));

    } catch (error) {
      console.error(`Failed to update ${sentiment} collection`, error);
      Alert.alert("Error", `Failed to update ${sentiment} sentiment`);
    }
  };

  const fetchSentimentCount = async (sentiment: 'bullish' | 'bearish', itemId: string) => {
    if (!itemId) return;

    setIsLoadingCounts(prev => ({ ...prev, [`${sentiment}-${itemId}`]: true }));

    try {
      const unsubscribe = firestore()
        .collection(sentiment)
        .doc(itemId)
        .onSnapshot(
          (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              const count = data?.uids?.length || 0;

              if (sentiment === 'bullish') {
                setBullishCounts(prev => ({ ...prev, [itemId]: count }));
              } else {
                setBearishCounts(prev => ({ ...prev, [itemId]: count }));
              }
            } else {
              // Document doesn't exist, set count to 0
              if (sentiment === 'bullish') {
                setBullishCounts(prev => ({ ...prev, [itemId]: 0 }));
              } else {
                setBearishCounts(prev => ({ ...prev, [itemId]: 0 }));
              }
            }
            setIsLoadingCounts(prev => ({ ...prev, [`${sentiment}-${itemId}`]: false }));
          },
          (error) => {
            console.error(`Error fetching ${sentiment} count:`, error);
            setIsLoadingCounts(prev => ({ ...prev, [`${sentiment}-${itemId}`]: false }));
          }
        );

      return unsubscribe;
    } catch (error) {
      console.error(`Failed to fetch ${sentiment} count:`, error);
      setIsLoadingCounts(prev => ({ ...prev, [`${sentiment}-${itemId}`]: false }));
      return undefined;
    }
  };

  const checkUserVote = async (itemId: string) => {
    if (!userinfo || !userinfo.uid) return;

    try {
      const [bullishDoc, bearishDoc] = await Promise.all([
        firestore().collection('bullish').doc(itemId).get(),
        firestore().collection('bearish').doc(itemId).get()
      ]);

      let userVote: 'bullish' | 'bearish' | null = null;

      if (bullishDoc.exists() && bullishDoc.data()?.uids && bullishDoc.data()?.uids.includes(userinfo.uid)) {
        userVote = 'bullish';
      } else if (bearishDoc.exists() && bearishDoc.data()?.uids && bearishDoc.data()?.uids.includes(userinfo.uid)) {
        userVote = 'bearish';
      }

      setUserVotes(prev => ({ ...prev, [itemId]: userVote }));
      setVotedItems(prev => ({ ...prev, [itemId]: userVote }));
    } catch (error) {
      console.error('Error checking user vote:', error);
    }
  };

  const handleBullish = async (itemId: string) => {
    if (!userinfo || !userinfo.uid) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      await updateSentimentCollection('bullish', itemId);
      // Fetch updated counts
      fetchSentimentCount('bullish', itemId);
      fetchSentimentCount('bearish', itemId);
    } catch (error) {
      console.error('Failed to handle bullish action:', error);
      Alert.alert("Error", "Failed to update bullish sentiment");
    }
  };

  const handleBearish = async (itemId: string) => {
    if (!userinfo || !userinfo.uid) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      await updateSentimentCollection('bearish', itemId);
      // Fetch updated counts
      fetchSentimentCount('bullish', itemId);
      fetchSentimentCount('bearish', itemId);
    } catch (error) {
      console.error('Failed to handle bearish action:', error);
      Alert.alert("Error", "Failed to update bearish sentiment");
    }
  };

  useEffect(() => {
    const newBullishPercentage: { [key: string]: number } = {};
    const newBearishPercentage: { [key: string]: number } = {};

    Object.keys(bullishCounts).forEach((id) => {
      const bullish = bullishCounts[id] || 0;
      const bearish = bearishCounts[id] || 0;
      const total = bullish + bearish;

      newBullishPercentage[id] = total > 0 ? Math.round((bullish / total) * 100) : 0;
      newBearishPercentage[id] = total > 0 ? Math.round((bearish / total) * 100) : 0;
    });

    setBullishPercentage(newBullishPercentage);
    setBearishPercentage(newBearishPercentage);
  }, [bullishCounts, bearishCounts]);

  const getBullishPercentage = (postId: string) => {
    const bullish = bullishCounts[postId] || 0;
    const bearish = bearishCounts[postId] || 0;
    const total = bullish + bearish;
    return total === 0 ? 0 : Math.round((bullish / total) * 100);
  };

  const getBearishPercentage = (postId: string) => {
    const bullish = bullishCounts[postId] || 0;
    const bearish = bearishCounts[postId] || 0;
    const total = bullish + bearish;
    return total === 0 ? 0 : 100 - getBullishPercentage(postId);
  };



  const handleBookmark = (itemId: string) => {
    if (!userinfo?.uid) {
      setShowLoginPrompt(true);
      return;
    }

    setBookmarkedItems(prev => {
      let newBookmarked;

      if (prev.includes(itemId)) {
        // Remove bookmark
        newBookmarked = prev.filter(id => id !== itemId);
        updateUserFirestoreArray('bookmarked', itemId, 'remove');
      } else {
        // Add bookmark
        newBookmarked = [...prev, itemId];
        updateUserFirestoreArray('bookmarked', itemId, 'add');

        // Show popup only when adding
        setBookmarkpop(true);
      }

      return newBookmarked;
    });
  };


  const handleShare = async (item: NewsItem) => {
    try {
      const shareMessage = `${item.title}\n\n${item.summary}\n\nRead more:`;
      await Share.share({
        message: shareMessage,
        title: item.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleReadMore = (url?: string) => {
    if (url) {

      navigation.navigate('Browser', { url: url })

    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateText = (text: any, maxWords: number = 60): string => {
    if (typeof text !== "string") return ""; // safety check
    
    // Split text into words while keeping emojis intact
    const words = text.trim().split(/\s+/); 
  
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(" ") + "…"; // nicer ellipsis
  };
  

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'bullish':
        return theme.bullish;
      case 'bearish':
        return theme.bearish;
      default:
        return theme.neutral;
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'bullish':
        return '📈';
      case 'bearish':
        return '📉';
      default:
        return '➡️';
    }
  };

  const goToNextCard = () => {
    if (currentCardIndex < filteredNewsList.length - 1) {
      // Add current item to swiped history
      const currentItem = filteredNewsList[currentCardIndex];
      setSwipedItems(prev => [...prev, currentItem.id]);

      // Save to Firestore history only if user is logged in
      if (userinfo && userinfo.uid) {
        updateUserFirestoreArray('history', currentItem.id);
      }

      setCurrentCardIndex(prev => prev + 1);
      // Reset animation values
      fadeOpacity.value = 1;
      cardTranslateY.value = 0;
      isTransitioning.value = false;
    }
  };

  const goToPreviousCard = () => {
    if (currentCardIndex > 0) {
      // Get the previous item
      const previousItem = filteredNewsList[currentCardIndex - 1];

      // Remove it from swiped history
      setSwipedItems(prev => prev.filter(id => id !== previousItem.id));

      // Optionally remove from Firestore history if logged in
      if (userinfo && userinfo.uid) {
        updateUserFirestoreArray('history', previousItem.id, true);
        // ^ assuming the 3rd param "true" tells it to remove instead of add
        // If your update function doesn't support remove, you'll need a separate function
      }

      // Move the card index back
      setCurrentCardIndex(prev => prev - 1);

      // Reset animation values
      fadeOpacity.value = 1;
      cardTranslateY.value = 0;
      isTransitioning.value = false;
    }
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      if (isTransitioning.value) return;
      context.startY = cardTranslateY.value;
    },

    onActive: (event, context: any) => {
      if (isTransitioning.value) return;

      const y = context.startY + event.translationY;

      // If swiping up
      if (event.translationY < 0) {
        cardTranslateY.value = y; // only move vertically, no fading
      }
      // If swiping down
      else {
        cardTranslateY.value = y * 0.8; // small resistance effect
        fadeOpacity.value = 1; // keep visible
      }
    },

    onEnd: (event) => {
      if (isTransitioning.value) return;

      const swipeUp = event.translationY < -80 && event.velocityY < -300;
      const swipeDown = event.translationY > 80 && event.velocityY > 300;

      if (swipeUp) {
        // Swipe up → next card
        if (!userinfo?.uid && currentCardIndex >= 2) {
          runOnJS(setShowScrollLoginPrompt)(true);
          cardTranslateY.value = withSpring(0);
          fadeOpacity.value = withSpring(1);
          return;
        }
        isTransitioning.value = true;
        cardTranslateY.value = withTiming(-500, { duration: 200 }, () => { // slide up out
          runOnJS(goToNextCard)();
        });
      }
      else if (swipeDown) {
        // Swipe down → previous card
        if (currentCardIndex > 0) {
          isTransitioning.value = true;
          cardTranslateY.value = withTiming(500, { duration: 200 }, () => { // slide down out
            runOnJS(goToPreviousCard)();
          });
        } else {
          // At first card → snap back
          cardTranslateY.value = withSpring(0);
        }
      }
      else {
        // Snap back if threshold not met
        cardTranslateY.value = withSpring(0);
        fadeOpacity.value = withSpring(1);
      }
    },
  });
  const currentItem = filteredNewsList[currentCardIndex];

  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: cardTranslateY.value }],
      opacity: fadeOpacity.value,
    };
  });

  // Fetch sentiment counts for current card
  useEffect(() => {
    if (currentItem) {
      let bullishUnsubscribe: (() => void) | undefined;
      let bearishUnsubscribe: (() => void) | undefined;

      const setupListeners = async () => {
        bullishUnsubscribe = await fetchSentimentCount('bullish', currentItem.id);
        bearishUnsubscribe = await fetchSentimentCount('bearish', currentItem.id);
        // Check user's previous vote
        await checkUserVote(currentItem.id);
      };

      setupListeners();

      // Cleanup function
      return () => {
        if (bullishUnsubscribe) bullishUnsubscribe();
        if (bearishUnsubscribe) bearishUnsubscribe();
      };
    }
  }, [currentItem]);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);

  useEffect(() => {
    if (Bookmarkpop) {
      // Show animation
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });

      const timer = setTimeout(() => {
        // Hide animation
        opacity.value = withTiming(0, { duration: 300 });
        translateY.value = withTiming(50, { duration: 300 });
        setBookmarkpop(false)
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [Bookmarkpop]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });










  const renderNewsCard = (item: NewsItem, isNextCard = false) => {
    const isLiked = likedItems.includes(item.id);
    const isBookmarked = bookmarkedItems.includes(item.id);
    const sentimentColor = getSentimentColor(item.sentiment);

    return (

      <Animated.View
        style={[
          styles.newsCard,
          isNextCard && styles.nextCard,
          {
            backgroundColor: theme.background,
            borderRadius: theme.borderRadius.md,
            height: RH(655) - RH(insets.bottom)
          },
        ]}
      >
        <View style={styles.imageContainer}>
          {item.image ? (
            <ImageWithLoader uri={item.image} style={styles.newsImage} />
          ) : (
            <View style={[styles.noImageContainer, { backgroundColor: theme.background }]}>
              <Image source={require('../assets/Logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
          )}

          {item.sentiment && (
            <View
              style={[
                styles.sentimentBadge,
                { backgroundColor: sentimentColor, borderRadius: theme.borderRadius.full },
              ]}
            >
              <Text style={styles.sentimentIcon}>{getSentimentIcon(item.sentiment)}</Text>
              <Text style={[styles.sentimentText, { color: theme.card }]}>{item.sentiment}</Text>
            </View>
          )}

          <View style={styles.topActionButtons}>
            <TouchableOpacity
              style={[
                styles.topActionButton,
                isBookmarked && styles.topActionButtonActive,
                { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
              ]}
              onPress={() => handleBookmark(item.id)}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isBookmarked ? theme.primaryLight : 'black'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topActionButton, { backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}
              onPress={() => handleShare(item)}
            >
              <MaterialCommunityIcons name="share-outline" color="black" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentContainer}>
          <Text style={[styles.newsTitle, { color: theme.text, }]} numberOfLines={3}>{item.title}</Text>

          <Text style={[styles.newsSummary, { color: theme.textSecondary }]} numberOfLines={10}>
            {item.summary}
          </Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: "center",
            marginTop: 6,
            height:RH(20),
             // small spacing from date
          }}>
            <Text style={{
              color: theme.textSecondary,
              fontSize: RFValue(12),
              fontFamily: "Lato-Regular",
              fontWeight: "400"
            }}>
              {item.timestamp ? format(new Date(item.timestamp), 'dd MMM yyyy') : 'No date'}
            </Text>

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={() => handleReadMore(item.original_url)}
            >
              <Text
                style={[styles.readMoreText, {
                  color: theme.primary,
                  fontSize: RFValue(12),
                  fontFamily: "Lato-Regular",
                  marginRight: 1,
                  height:RH(17), // spacing before arrow
                }]}
                numberOfLines={1} // prevent wrapping
              >
                Read more at {item.source}
              </Text>
              <MaterialIcons
                name="arrow-forward-ios"
                size={11}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>


          <View style={[styles.sentimentButtons]}>
            {userVotes[item.id] ? (
              <View style={styles.percentageContainer}>
                <View style={styles.percentageBar}>
                  {getBullishPercentage(item.id) === 100 ? (
                    <View
                      style={[
                        styles.bullishBar,
                        { width: '100%', backgroundColor: theme.bullish },
                      ]}
                    >
                      <Text style={[styles.percentageText, { color: '#fff' }]}>100%</Text>
                    </View>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.bullishBar,
                          { width: `${getBullishPercentage(item.id)}%`, backgroundColor: theme.bullish },
                        ]}
                      >
                        <Text style={[styles.percentageText, { color: '#fff' }]}>{getBullishPercentage(item.id)}%</Text>
                      </View>
                      <View
                        style={[
                          styles.bearishBar,
                          { width: `${getBearishPercentage(item.id)}%`, backgroundColor: theme.bearish },
                        ]}
                      >
                        <Text style={[styles.percentageText, { color: '#fff' }]}>{getBearishPercentage(item.id)}%</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ) : (
              <View style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end", marginTop: 10, gap: 10 }} >
                <TouchableOpacity
                  style={[styles.sentimentButton, { borderRadius: 20, backgroundColor: theme.bullish }]}
                  onPress={() => handleBullish(item.id)}
                >
                  <Ionicons name="trending-up" size={16} color={theme.card} />
                  <Text style={[styles.sentimentButtonText, { color: theme.card }]}>Bullish</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sentimentButton, { borderRadius: 20, backgroundColor: theme.bearish }]}
                  onPress={() => handleBearish(item.id)}
                >
                  <Ionicons name="trending-down" size={16} color={theme.card} />
                  <Text style={[styles.sentimentButtonText, { color: theme.card }]}>Bearish</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Animated.View style={[styles.B_main_popup, animatedStyle, { backgroundColor: "#D9E9FF", bottom: RH(12) }]}>
            <View style={styles.B_img_con}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={{ width: '100%', height: '100%', borderRadius: 30 }}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={require('../assets/Logo.png')}
                  style={{ width: '100%', height: '100%', borderRadius: 30 }}
                  resizeMode="contain"
                />
              )}
            </View>
            <Text style={{
              color: "#344054", fontFamily: "Inter_28pt-Regular",
              fontWeight: "400"
            }}>Story saved to Profile</Text>
          </Animated.View>
        </View>
      </Animated.View>
    );
  };



  if (isInitialLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background, }]}>


        {/* Header */}
        <Animated.View style={[styles.header]}>
          <View style={[styles.searchContainer, { borderRadius: theme.borderRadius.sm, }]}>
            <Ionicons name="search" size={20} color={theme.card} style={styles.searchIcon} />
            <View style={[styles.searchInput, { backgroundColor: 'transparent' }]} />
          </View>
        </Animated.View>

        {/* Shimmer Card - Centered */}
        <View style={[styles.shimmerCardContainer]}>
          <View style={[styles.newsCard, { backgroundColor: theme.card }]}>
            {/* Image Shimmer */}
            <ShimmerEffect
              width="100%"
              height={RH(isTablet ? 280 : 230)}
              borderRadius={RW(8)}
              style={[styles.imageContainer]}
            />

            {/* Content Shimmer */}
            <View style={styles.contentContainer}>
              {/* Source */}
              <ShimmerEffect
                width={RW(120)}
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSource}
              />

              {/* Title - Multiple lines */}
              <ShimmerEffect
                width="100%"
                height={RH(24)}
                borderRadius={RW(4)}
                style={styles.shimmerTitle}
              />
              <ShimmerEffect
                width="90%"
                height={RH(24)}
                borderRadius={RW(4)}
                style={styles.shimmerTitle}
              />

              {/* Summary - Multiple lines */}
              <ShimmerEffect
                width="100%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />
              <ShimmerEffect
                width="95%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />
              <ShimmerEffect
                width="80%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />
              <ShimmerEffect
                width="60%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />

              {/* Date and Read More */}
              <View style={styles.shimmerBottomRow}>
                <ShimmerEffect
                  width={RW(100)}
                  height={RH(14)}
                  borderRadius={RW(4)}
                  style={styles.shimmerDate}
                />
                <ShimmerEffect
                  width={RW(120)}
                  height={RH(14)}
                  borderRadius={RW(4)}
                  style={styles.shimmerReadMore}
                />
              </View>

              {/* Sentiment Buttons */}
              <View style={styles.shimmerButtonsContainer}>
                <ShimmerEffect
                  width={RW(80)}
                  height={RH(40)}
                  borderRadius={RW(20)}
                  style={styles.shimmerButton}
                />
                <ShimmerEffect
                  width={RW(80)}
                  height={RH(40)}
                  borderRadius={RW(20)}
                  style={styles.shimmerButton}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Network Connection Popup */}
        <NetworkPopup
          visible={showNetworkPopup}
          onClose={() => setShowNetworkPopup(false)}
          onRetry={checkNetworkConnectivity}
          isDarkMode={isDarkMode}
        />
      </SafeAreaView>
    );
  }

  if (isInitialLoadingSearch) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background, }]}>


        {/* Header */}
        <Animated.View style={[styles.header]}>
          <View style={[styles.searchContainer, { borderRadius: theme.borderRadius.sm, backgroundColor: isDarkMode ?theme.background :'rgba(233,242,254,255)' }]}>
            <Ionicons name="search" size={20} color={theme.card} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: "gray", backgroundColor: isDarkMode ?theme.background :'rgba(233,242,254,255)' }]}
              placeholder="Search articles..."
              placeholderTextColor="gray"
              value={tempSearchQuery}
              onChangeText={handleTextChange}  // <-- use new handler
              returnKeyType="search"
              blurOnSubmit={true}
              onSubmitEditing={handleSearch}
            />   // trigger search only on Enter
            {tempSearchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setTempSearchQuery('');
                  handleTextChange('');
                }}
              >
                <Ionicons name="close-circle" size={20} color={theme.card} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Shimmer Card - Centered */}
        <View style={[styles.shimmerCardContainer]}>
          <View style={[styles.newsCard, { backgroundColor: theme.card }]}>
            {/* Image Shimmer */}
            <ShimmerEffect
              width="100%"
              height={RH(isTablet ? 280 : 230)}
              borderRadius={RW(8)}
              style={[styles.imageContainer]}
            />

            {/* Content Shimmer */}
            <View style={styles.contentContainer}>
              {/* Source */}
              <ShimmerEffect
                width={RW(120)}
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSource}
              />

              {/* Title - Multiple lines */}
              <ShimmerEffect
                width="100%"
                height={RH(24)}
                borderRadius={RW(4)}
                style={styles.shimmerTitle}
              />
              <ShimmerEffect
                width="90%"
                height={RH(24)}
                borderRadius={RW(4)}
                style={styles.shimmerTitle}
              />

              {/* Summary - Multiple lines */}
              <ShimmerEffect
                width="100%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />
              <ShimmerEffect
                width="95%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />
              <ShimmerEffect
                width="80%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />
              <ShimmerEffect
                width="60%"
                height={RH(16)}
                borderRadius={RW(4)}
                style={styles.shimmerSummary}
              />

              {/* Date and Read More */}
              <View style={styles.shimmerBottomRow}>
                <ShimmerEffect
                  width={RW(100)}
                  height={RH(14)}
                  borderRadius={RW(4)}
                  style={styles.shimmerDate}
                />
                <ShimmerEffect
                  width={RW(120)}
                  height={RH(14)}
                  borderRadius={RW(4)}
                  style={styles.shimmerReadMore}
                />
              </View>

              {/* Sentiment Buttons */}
              <View style={styles.shimmerButtonsContainer}>
                <ShimmerEffect
                  width={RW(80)}
                  height={RH(40)}
                  borderRadius={RW(20)}
                  style={styles.shimmerButton}
                />
                <ShimmerEffect
                  width={RW(80)}
                  height={RH(40)}
                  borderRadius={RW(20)}
                  style={styles.shimmerButton}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Network Connection Popup */}
        <NetworkPopup
          visible={showNetworkPopup}
          onClose={() => setShowNetworkPopup(false)}
          onRetry={checkNetworkConnectivity}
          isDarkMode={isDarkMode}
        />
      </SafeAreaView>
    );
  }

  if (!currentItem) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background, }]}>


        {/* Header */}
        <Animated.View style={[styles.header]}>
          {/* Search Input */}
          <View style={[styles.searchContainer, { borderRadius: theme.borderRadius.sm,backgroundColor: isDarkMode ?theme.background :'rgba(233,242,254,255)' }]}>
            <Ionicons name="search" size={20} color={theme.card} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: "gray", backgroundColor: isDarkMode ?theme.background :'rgba(233,242,254,255)'}]}
              placeholder="Search articles..."
              placeholderTextColor="gray"
              value={tempSearchQuery}
              onChangeText={handleTextChange}  // <-- use new handler
              returnKeyType="search"
              blurOnSubmit={true}
              onSubmitEditing={handleSearch}
            />   // trigger search only on Enter
            {tempSearchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setTempSearchQuery('');
                  handleTextChange('');
                }}
              >
                <Ionicons name="close-circle" size={20} color={theme.card} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <View style={styles.emptyContainer}>
          {searchQuery ? (
            // No search results - show message
            <>
              <Text style={[styles.emptyTitle, { color: theme.text, }]}>
                No articles found
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary, }]}>
                Try adjusting your search terms
              </Text>
            </>
          ) : (
            // Loading state - show shimmer placeholders
            <>
            </>
          )}
        </View>

        {/* Network Connection Popup */}
        <NetworkPopup
          visible={showNetworkPopup}
          onClose={() => setShowNetworkPopup(false)}
          onRetry={checkNetworkConnectivity}
          isDarkMode={isDarkMode}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView
        >

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? getStatusBarHeight() : 0}
          >
            {/* Header */}
            <Animated.View style={styles.header}>
              {/* Search Input */}
              <View style={[styles.searchContainer, { borderRadius: theme.borderRadius.sm ,backgroundColor: isDarkMode ?theme.background :'rgba(233,242,254,255)'}]}>
                <Ionicons name="search" size={20} color={theme.card} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: "gray", backgroundColor: isDarkMode ?theme.background :'rgba(233,242,254,255)' }]}
                  placeholder="Search articles..."
                  placeholderTextColor="gray"
                  value={tempSearchQuery}
                  onChangeText={handleTextChange}  // <-- use new handler
                  returnKeyType="search"
                  blurOnSubmit={true}
                  onSubmitEditing={handleSearch}
                />  // trigger search only on Enter



                {tempSearchQuery.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={() => {
                    setTempSearchQuery('');
                    handleTextChange('');
                  }}>
                    <Ionicons name="close-circle" size={20} color={theme.card} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>

            {/* Card Stack */}
            <View style={styles.cardContainer}>
              {currentCardIndex >= filteredNewsList.length ? (
                // No more cards
                <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
                  <Ionicons
                    name="newspaper-outline"
                    size={RW(80)}
                    color={theme.textSecondary}
                    style={{ marginBottom: RH(20) }}
                  />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No More Articles</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                    You've viewed all available articles.{"\n"}Check back later for more news!
                  </Text>
                  <TouchableOpacity
                    style={[styles.refreshButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      setCurrentCardIndex(0);
                      setSwipedItems([]);
                      setLikedItems([]);
                      setBookmarkedItems([]);
                    }}
                  >
                    <Text style={[styles.refreshButtonText, { color: theme.card }]}>
                      Refresh Articles
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (


                /* Current Card */
                <PanGestureHandler onGestureEvent={gestureHandler}>
                  <Animated.View style={[styles.cardWrapper, cardStyle, {
                  }]}>
                    {renderNewsCard(currentItem)}
                  </Animated.View>
                </PanGestureHandler>

              )}
            </View>
          </KeyboardAvoidingView>

          {/* Modals - outside KeyboardAvoidingView so keyboard doesn't shift them */}
          <LoginPrompt
            visible={showLoginPrompt}
            onClose={() => setShowLoginPrompt(false)}
            title="Sign in to continue"
            message="Create an account to like, bookmark, and personalize your news feed."
            isDarkMode={isDarkMode}
          />

          <LoginPrompt
            visible={showScrollLoginPrompt}
            onClose={() => setShowScrollLoginPrompt(false)}
            title="Sign in to continue reading"
            message="Please sign in to access more articles"
            isDarkMode={isDarkMode}
          />

          <NetworkPopup
            visible={showNetworkPopup}
            onClose={() => setShowNetworkPopup(false)}
            onRetry={checkNetworkConnectivity}
            isDarkMode={isDarkMode}
          />


        </ScrollView>
      </GestureHandlerRootView>

    </SafeAreaView>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    left: 0,
    right: 0,
    zIndex: 1
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RW(12),
    width: isTablet ? '85%' : '92%',
    alignSelf: 'center',
    height: RH(isTablet ? 60 : 50),
  },
  searchIcon: {
    marginRight: RW(8),
    color: "gray",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: RFValue(16),
    fontFamily: "Lato-Regular",
    fontWeight: "400"

  },
  clearButton: {
    marginLeft: RW(8),
  },
  cardContainer: {
    flex: 1,
    width: '100%',// Increased top margin to avoid overlap with search
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmerCardContainer: {
    flex: 1,
    width: '100%',// Increased top margin to avoid overlap with search
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    position: "static",
    width: '100%',
  },
  nextCard: {
    transform: [{ scale: 0.9 }],
    opacity: 0.7,
  },
  newsCard: {
    overflow: 'hidden',
    marginTop: RH(15),
    marginHorizontal: RW(isTablet ? 24 : 16),
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
    width: '100%',
  },
  newsImage: {
    width: '100%',
    height: '100%',
    resizeMode: "cover",
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageIcon: {
    fontSize: RFValue(isTablet ? 64 : 48),
    marginBottom: RH(8),
    fontFamily:"lato.medium",
    fontWeight:"400"
  },
  noImageText: {
    fontSize: RFValue(isTablet ? 18 : 14),
  },
  sentimentBadge: {
    position: 'absolute',
    top: RH(isTablet ? 15 : 10),
    left: RW(12),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RW(8),
    paddingVertical: RH(4),

  },
  sentimentIcon: {
    fontSize: RFValue(12),
    marginRight: RW(4),
  },
  sentimentText: {
    fontSize: RFValue(10),
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  topActionButtons: {
    position: 'absolute',
    bottom: RH(12),
    right: RW(isTablet ? 12 : 8),
    flexDirection: 'row',
    gap: RW(isTablet ? 12 : 10),
  },
  topActionButton: {
    width: RW(isTablet ? 40 : 30),
    height: RW(isTablet ? 40 : 30),
    borderRadius: RW(isTablet ? 24 : 18),
    justifyContent: 'center',
    alignItems: 'center',
    color: "blue"
  },
  topActionButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  contentContainer: {
    paddingVertical: RH(isTablet ? 10 : 12),
    flex: 1,
  },
  sourceText: {
    fontSize: RFValue(isTablet ? 14 : 12),
    marginBottom: RH(8),
  },
  newsTitle: {
    fontSize: RFValue(isTablet ? 28 : 22),
    fontWeight: '600',
    marginBottom: RH(8),
    lineHeight: RFValue(isTablet ? 38 : 28),
    fontFamily: "Lato-Regular"
  },
  newsSummary: {
    fontSize: RFValue(isTablet ? 22 : 14),
    lineHeight: RFValue(isTablet ? 30 : 25),
    marginBottom: RH(12),
    fontFamily: "Lato-Regular",
    fontWeight: "400"
  },
  readMoreContainer: {
    flexDirection: 'row',
    gap: RW(1),
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  readMoreText: {
    fontSize: RFValue(isTablet ? 18 : 13),
    alignSelf: 'flex-end',
    fontFamily: "Lato-Regular",
  },
  arrowcone: {

    marginTop: RH(2)
  },
  sentimentButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: RH(isTablet ? 15 : 10),
    right: RW(0),
    gap: RW(isTablet ? 16 : 12),
  },

  sentimentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: "center",
    gap: RW(2),
    paddingHorizontal: RW(isTablet ? 20 : 16),
    paddingVertical: RH(isTablet ? 12 : 10),
    marginRight: RW(isTablet ? 12 : 0)
  },
  bullishButton: {

  },
  bearishButton: {

  },
  sentimentButtonText: {
    fontSize: RFValue(isTablet ? 14 : 12),
    fontFamily: "Lato-Regular",
    fontWeight: "400"
  },
  sentimentCount: {
    fontSize: RFValue(12),

    fontWeight: '600',
    marginLeft: RW(4),
  },
  countLoader: {
    marginLeft: RW(4),
  },
  cardCounter: {
    position: 'absolute',
    top: RH(20),
    right: RW(20),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: RW(12),
    paddingVertical: RH(6),

  },
  counterText: {
    fontSize: RFValue(12),

    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: RH(60),
  },
  emptyTitle: {
    fontSize: RFValue(isTablet ? 24 : 20),
    fontWeight: '600',
    marginBottom: RH(8),
  },
  emptySubtitle: {
    fontSize: RFValue(isTablet ? 18 : 16),
    textAlign: 'center',
    lineHeight: RFValue(24),
  },
  refreshButton: {
    marginTop: RH(24),
    paddingHorizontal: RW(24),
    paddingVertical: RH(12),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {

    padding: RW(24),
    marginHorizontal: RW(20),
    alignItems: 'center',
    maxWidth: RW(300),
  },
  loginPromptTitle: {
    fontSize: RFValue(20),
    fontWeight: '700',

    marginTop: RH(12),
    marginBottom: RH(8),
  },
  loginPromptText: {
    fontSize: RFValue(16),

    textAlign: 'center',
    marginBottom: RH(20),
    lineHeight: RFValue(22),
  },
  loginPromptButtons: {
    flexDirection: 'row',
    gap: RW(12),
  },
  loginPromptButton: {
    flex: 1,
  },
  shimmerSource: {
    marginBottom: RH(8),
  },
  shimmerTitle: {
    marginBottom: RH(8),
  },
  shimmerSummary: {
    marginBottom: RH(4),
  },
  shimmerDate: {
    marginBottom: RH(8),
  },
  shimmerButtons: {
    marginTop: RH(8),
  },
  shimmerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: RH(8),
  },
  shimmerReadMore: {
    // Width and height handled by ShimmerEffect props
  },
  shimmerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: RW(12),
    position: 'absolute',
    bottom: RH(10),
    right: RW(0),
  },
  shimmerButton: {
    // Width and height handled by ShimmerEffect props
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',

    zIndex: 1,
  },
  hiddenImage: {
    opacity: 0,
  },
  imageError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',

    zIndex: 1,
  },
  imageErrorText: {
    marginTop: RH(10),
    fontSize: RFValue(isTablet ? 16 : 14),
  },

  sentimentButtons: {
    position: "absolute",
    bottom: RH(10),
    right: RW(0),
  },
  percentageBar: {
    flexDirection: 'row',
    width: "80%",
    height: 30,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bullishBar: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bearishBar: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  percentageContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  percentageText: {
    fontSize: RFValue(isTablet ? 14 : 12),
    fontFamily: "Lato-Regular",
    fontWeight: "500"
  },
  logo: {
    height: 120,
    width: 120
  },

  B_main_popup: {
    position: "absolute",
    height: 45,
    width: 200,
    borderRadius: 100,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    gap: 10
  },
  B_img_con: {
    height: 30,
    width: 30,
    borderRadius: 30,
  }

});

export default DiscoverScreens;
