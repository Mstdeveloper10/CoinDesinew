import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  Alert,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  SafeAreaView,
  AppState,
  FlatList,
  Keyboard,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import { launchImageLibrary } from 'react-native-image-picker';
import { updateProfileImage, uploadUserinfo, clearUser, UpdateisLoggedin } from '../redux/action/action';
import { toggleTheme } from '../redux/action/themeActions';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { createTheme, RFValue } from '../utils/theme';
import Button from '../components/Button';
import LoginPrompt from '../components/LoginPrompt';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogoutModal from '../components/LogoutModal';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Linking } from 'react-native';
import { checkNotifications } from 'react-native-permissions';
import { serverTimestamp } from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
const RW = val => wp((val / 375) * 100); // responsive width base 375
const RH = val => hp((val / 812) * 100); // responsive height base 812

const Profilepage = () => {
  const dispatch = useDispatch();
  const [uploading, setUploading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOtp, setShowOtp] = useState(false)
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editphone, setEditPhone] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [title, setTitle] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState<'success' | 'error' | 'login' | 'info'>('info');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupTitle, setPopupTitle] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showModal, setShowModal] = useState(false);
  const [countryCodes, setCountryCodes] = useState<Array<{ name: string; dialCode: string; code: string }>>([]);
  const [selectedCode, setSelectedCode] = useState('+91');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [phoneNo, setPhoneNo] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputs = Array.from({ length: 6 }, () => useRef<TextInput>(null));
  const [inlineError, setInlineError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
const [phoneNumber, setPhoneNumber] = useState('');
const timestamp = new Date().toISOString();;

  const userInfo = useSelector((state: any) => state.user.userinfo);
  const isDarkMode = useSelector((state: any) => state.theme.isDarkMode);
  const navigation = useNavigation();

  const theme = createTheme(isDarkMode);

  // Animation values
  const profileScale = useSharedValue(1);
  const profileOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(RH(50));
  const cardOpacity = useSharedValue(0);
  const successAlertOpacity = useSharedValue(0);
  const successAlertScale = useSharedValue(0.8);

  useEffect(() => {
    fetchCountryCodes();
  })

  const fetchCountryCodes = async () => {
    try {
      const res = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,idd");
      const data = await res.json();
      const countryList = data
        .filter((item: any) => item.idd?.root && item.idd?.suffixes?.length > 0)
        .map((item: any) => ({
          name: item.name.common,
          dialCode: `${item.idd.root}${item.idd.suffixes[0]}`,
          code: item.cca2,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      setCountryCodes(countryList);
    } catch (error) {
      console.error('Error fetching country codes:', error);
    }
  };

  useEffect(() => {
    profileOpacity.value = withTiming(1, { duration: 800 });
    profileScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    const timer = setTimeout(() => {
      cardOpacity.value = withTiming(1, { duration: 600 });
      cardTranslateY.value = withSpring(0, { damping: 12, stiffness: 100 });
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (userInfo && !userInfo.profileImageUrl) {
      setImageLoading(false);
    }
  }, [userInfo]);

  useEffect(() => {
    if (userInfo) {
      setEditName(userInfo.name || '');
      setEditEmail(userInfo.email || '');
      setEditPhone(userInfo.phone || '');
    }
  }, [userInfo]);

  const showSuccessMessage = (title: string, message: string,) => {
    setTitle(title)
    setSuccessMessage(message);
    setShowSuccessAlert(true);

    successAlertOpacity.value = withTiming(1, { duration: 300 });
    successAlertScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    setTimeout(() => {
      hideSuccessMessage();
    }, 3000);
  };

  const hideSuccessMessage = () => {
    successAlertOpacity.value = withTiming(0, { duration: 300 });
    successAlertScale.value = withSpring(0.8, { damping: 12, stiffness: 100 });

    setTimeout(() => {
      setShowSuccessAlert(false);
    }, 300);
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1027380469055-9oh24gpfgudqb1eh7ticqebs2enjhm2i.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const onGoogleButtonPress = async (userInfo) => {
    try {
      // Step 1: Google Sign In
      const googleUser = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        showSuccessMessage("Google login failed: No ID token found.");
        setShowSuccessModal(false);
        return;
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Step 2: Link Google credential with existing phoneAuth user
      const currentUser = auth().currentUser;

      try {
        await currentUser.linkWithCredential(googleCredential);
        showSuccessMessage("🎉 Your Google account has been successfully linked!");
      } catch (error) {
        // Clear Google session so next time user can pick a new email
        await GoogleSignin.signOut();

        switch (error.code) {
          case "auth/credential-already-in-use":
            await auth().signInWithCredential(googleCredential);
            showSuccessMessage("This Google account was already linked. You are now signed in.");
            break;

          case "auth/provider-already-linked":
          case "auth/unknown": // Android sometimes throws this instead
          case "auth/email-already-in-use":
            showSuccessMessage("This email is already used by another account.");
            setShowSuccessModal(false);
            return;

          default:
            console.error("Google link unexpected error:", error);
            showSuccessMessage("Something went wrong while linking Google. Please try again.");
            setShowSuccessModal(false);
            return;
        }
      }

      setShowSuccessModal(false);

      // Step 3: Extract Google account info
      const googleName = googleUser.user?.name || "User";
      const googlePhoto = googleUser.user?.photo || null;
      const googleEmail = googleUser.user?.email;
      const { uid } = auth().currentUser;

      // Step 4: Check if email exists in Firestore for another user
      const querySnapshot = await firestore()
        .collection("users")
        .where("email", "==", googleEmail)
        .get();

      if (!querySnapshot.empty && querySnapshot.docs[0].id !== uid) {
        showSuccessMessage("This email is already associated with another account.");
        setShowSuccessModal(false);
        return;
      }

      // Step 5: Create user object
      const updatedUser = {
        uid,
        phone: userInfo.phone,
        email: googleEmail,
        name: googleName,
        profileImageUrl:
          googlePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(googleName)}`,
        googleAuth: true,
        updatedAt: serverTimestamp(),
      };

      // Step 6: Save to Firestore
      await firestore().collection("users").doc(uid).set(updatedUser, { merge: true });

      // Step 7: Save to AsyncStorage
      await AsyncStorage.setItem("userinfo", JSON.stringify(updatedUser));

      // Step 8: Update Redux (refresh UI)
      dispatch(uploadUserinfo(updatedUser));

      showSuccessMessage("Profile updated with your Google account!");
      setShowSuccessModal(false);
    } catch (error) {
      // Clear Google session so next login prompts account chooser
      await GoogleSignin.signOut();

      console.error("Google Sign-In unexpected error:", error);
      showSuccessMessage("Something went wrong during Google sign in. Please try again.");
      setShowSuccessModal(false);
    }
  };

  const handleProfileImageUpload = async () => {
    if (!userInfo?.uid) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (!result.assets?.length || !result.assets[0].uri) return;

      setUploading(true);

      const uri = result.assets[0].uri; // ✅ FIXED

      const fileName = `profile_photos/${userInfo.uid}.jpg`;
      const reference = storage().ref(fileName);

      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();

      await firestore()
        .collection('users')
        .doc(userInfo.uid)
        .set({ profileImageUrl: downloadURL }, { merge: true });

      dispatch(updateProfileImage(downloadURL)); // ✅ updates Redux
      setImageLoading(true);
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      Alert.alert('Error', 'Failed to upload profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!userInfo?.uid) {
      Alert.alert('Error', 'You need to be logged in to update your phone number.');
      return;
    }
  
    // Clean input
    const cleanedPhone = phoneNo.replace(/\D/g, ''); // remove non-digit characters
    if (cleanedPhone.length < 6) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }
  
    const formattedPhone = selectedCode + cleanedPhone; // e.g., +911234567890
  
    try {
      setIsUpdating(true); // optional loading state
  
      // Update only the phone field in Firestore
      await firestore()
        .collection('users')
        .doc(userInfo.uid)
        .set({ phone: formattedPhone }, { merge: true });
  
      // Update Redux so UI reflects change
      dispatch(uploadUserinfo({ ...userInfo, phone: formattedPhone }));
  
      Alert.alert('Success', 'Phone number updated successfully!');
      setShowEditModal(false); // close edit modal
    } catch (error) {
      console.error('Failed to update phone number:', error);
      Alert.alert('Error', 'Failed to update phone number. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(userInfo?.name || '');
    setEditEmail(userInfo?.email || '');
    setShowEditModal(false);
  };

  const handleLogout = async () => {
    try {
      await auth().signOut();
      await GoogleSignin.signOut();

      await AsyncStorage.multiRemove([
        'user_data',
        'user_preferences',
        'auth_tokens',
        'fcm_token',
        'userinfo',
        'skip',
        'isLoggedin',
      ]);

      dispatch(clearUser());
      dispatch(UpdateisLoggedin(false));
    } catch (error) {
      console.error('Error during logout:', error);
      dispatch(clearUser());
      navigation.navigate('profile' as never);
    }
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const checkPermission = async () => {
    if (isCheckingPermissions.current) return;

    try {
      isCheckingPermissions.current = true;
      setIsChecking(true);

      const { status } = await checkNotifications();
      console.log("🔔 Permission status:", status);

      setPushNotifications(status === "granted");
    } catch (error) {
      console.error("❌ Error checking permissions:", error);
      setPushNotifications(false);
    } finally {
      isCheckingPermissions.current = false;
      setIsChecking(false);
    }
  };

  // 📱 App state listener to refresh on resume
  useEffect(() => {
    checkPermission();

    const handleAppStateChange = (state) => {
      if (state === "active") {
        setTimeout(checkPermission, 300);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  // ⚙️ Open app notification settings
  const openNotificationSettings = async () => {
    if (Platform.OS === "android") {
      try {
        if (Platform.Version >= 26) {
          // Opens directly to this app's notification settings on Android 8+
          await Linking.openSettings();
        } else {
          const canOpen = await Linking.canOpenURL("app-settings:");
          if (canOpen) {
            await Linking.openURL("app-settings:");
          } else {
            await Linking.openSettings();
          }
        }
      } catch (e) {
        console.error("Failed to open settings:", e);
        Alert.alert(
          "Settings Unavailable",
          "Please manually check notification settings in your device settings."
        );
      }
    } else {
      try {
        await Linking.openSettings();
      } catch (e) {
        console.error("Failed to open iOS settings:", e);
        Alert.alert(
          "Settings Unavailable",
          "Please manually check notification settings in your device settings."
        );
      }
    }
  };

  // 🔘 Toggle handler with user-friendly alert
  const handlePushNotificationToggle = () => {
    const currentStatus = pushNotifications ? "enabled" : "disabled";
    const action = pushNotifications ? "disable" : "enable";

    Alert.alert(
      "Update Notification Settings",
      `Notifications are currently ${currentStatus}.\n\nYou'll be redirected to system settings to ${action} them. After making changes, please reopen this app to refresh the status.`,
      [
        {
          text: "Go to Settings",
          onPress: openNotificationSettings,
          style: "default"
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ],
      { cancelable: true }
    );
  };

  // Animated styles
  const profileAnimatedStyle = useAnimatedStyle(() => ({
    opacity: profileOpacity.value,
    transform: [{ scale: profileScale.value }],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const successAlertAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successAlertOpacity.value,
    transform: [{ scale: successAlertScale.value }],
  }));

  const handleTermandCondition = () => {
    let url = "https://coindesi.ai/terms-conditions/"
    navigation.navigate('Browser', { url: url })
  };

  const handlePrivacyandPolicy = () => {
    let url = "https://coindesi.ai/privacy-policy/"
    navigation.navigate('Browser', { url: url })
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (resendTimer > 0 && !canResend) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [resendTimer, canResend]);

  const handleResendOtp = async () => {
    if (!canResend || isResending) {
      logWithTimestamp('WARN', 'Resend blocked', { canResend, isResending });
      return;
    }

    const startTime = Date.now();
    logWithTimestamp('INFO', 'Starting OTP resend');

    try {
      setIsResending(true);
      setOtpDigits(['', '', '', '', '', '']);
      setInlineError('');

      // Prepare phone number
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const e164Phone = `${selectedCode}${cleanedPhone}`;

      logWithTimestamp('INFO', 'Sending new OTP', { phone: e164Phone.replace(/\d(?=\d{4})/g, '*') });

      const newConfirmation = await auth().signInWithPhoneNumber(e164Phone);
      setConfirmation(newConfirmation);
      dispatch({ type: 'SET_CONFIRMATION', payload: newConfirmation });

      // Reset timer
      setResendTimer(60);
      setCanResend(false);

      const duration = Date.now() - startTime;
      logWithTimestamp('INFO', 'OTP resent successfully', { duration: `${duration}ms` });

      // Show success feedback
      Alert.alert('Success', 'A new verification code has been sent to your phone.');

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logWithTimestamp('ERROR', 'Failed to resend OTP', {
        error: error.message,
        code: error.code,
        duration: `${duration}ms`
      });

      let userMessage = 'Failed to resend OTP. Please try again.';

      switch (error.code) {
        case 'auth/too-many-requests':
          userMessage = 'Too many requests. Please wait before requesting another code.';
          break;
        case 'auth/network-request-failed':
          userMessage = 'Network error. Please check your connection.';
          break;
        case 'auth/invalid-phone-number':
          userMessage = 'Invalid phone number. Please go back and try again.';
          break;
        case 'auth/quota-exceeded':
          userMessage = 'SMS quota exceeded. Please try again later.';
          break;
      }

      setErrorModalMessage(userMessage);
      setShowErrorModal(true);

    } finally {
      setIsResending(false);
    }
  };

  const logWithTimestamp = (level: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [OTP_VERIFICATION] [${level}] ${message}`;

    if (level === 'ERROR') {
      console.error(logMessage, data || '');
    } else if (level === 'WARN') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
  };

  useEffect(() => {
    return () => {
      logWithTimestamp('INFO', 'OTP Verification component unmounting');
    };
  }, []);

  const handleSendOtp = async () => {
    logWithTimestamp("INFO", "Starting OTP send process");
  
    try {
      if (otpLoading) return; // prevent multiple taps
  
      const formattedPhone = selectedCode + phoneNo;
  
      // Basic phone number validation (10-15 digits)
      if (!/^\d{10,15}$/.test(phoneNo)) {
        showSuccessMessage("Please enter a valid phone number.");
        return;
      }
  
      setOtpLoading(true);
      setPhoneNumber(formattedPhone); // ✅ save it for verify step
  
      // 🔎 Check in Firestore before sending OTP
      const phoneQuery = await firestore()
        .collection("users")
        .where("phone", "==", phoneNo)
        .limit(1)
        .get();
  
      if (!phoneQuery.empty) {
        // 🚨 Phone already registered
        setShowEditModal(false)
        showSuccessMessage(
          "Number Already Registered",
          "This phone number is already associated with an account. Please log in instead."
        );
        setOtpLoading(false);
        return;
      }
  
      // ✅ Phone not found → Send OTP using Firebase
      const confirmationResult = await auth().signInWithPhoneNumber(formattedPhone);
  
      setConfirmation(confirmationResult); // store for verification later
      setOtpSuccess(true);
  
      setTimeout(() => {
        setOtpSuccess(false);
        setShowOtp(true);
        setShowEditModal(false)
        
      }, 2000);
      
  
      logWithTimestamp("INFO", "OTP sent successfully", { phone: formattedPhone });
  
    } catch (error: any) {
      console.error("OTP send error:", error);
      setShowEditModal(false)
      showSuccessMessage(
        error?.message ||
          "Failed to send OTP. Make sure your device has Play Services and a valid SHA key."
      );
    } finally {
      setOtpLoading(false);
    }
  };
  
  const handleOtpChange = (text: string, index: number) => {
    try {
      // Clean input - remove non-digits
      const cleanText = text.replace(/\D/g, '');

      // Handle paste of full OTP
      if (cleanText.length > 1) {
        logWithTimestamp('INFO', 'Multiple digits detected, handling as paste', { text: cleanText });
        handlePastedOtp(cleanText, index);
        return;
      }

      const digit = cleanText.slice(0, 1);
      const newDigits = [...otpDigits];
      newDigits[index] = digit;
      setOtpDigits(newDigits);

      // Auto-focus next input
      if (digit && index < otpInputs.length - 1) {
        otpInputs[index + 1].current?.focus();
      }

      // Clear inline error when user starts typing
      if (inlineError) {
        setInlineError('');
      }

      // Auto-verify when all digits are entered
      if (newDigits.every((d) => d && d.trim().length > 0)) {
        Keyboard.dismiss();
        logWithTimestamp('INFO', 'All OTP digits entered, auto-verifying');
        setTimeout(() => {
          handleVerifyOtp(newDigits.join(''));
        }, 100);
      }

    } catch (error) {
      logWithTimestamp('ERROR', 'Error handling OTP input change', error);
    }
  };

  // Enhanced OTP verification with better error handling
 const handleVerifyOtp = async (manualOtp?: string) => {
  setInlineError("");
  const code = manualOtp || otpDigits.join("");

  // 🔹 Basic input validation
  if (code.length !== 6) {
    setInlineError("Please enter all 6 digits.");
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    setInlineError("Please enter only numbers.");
    return;
  }
  if (!confirmation) {
    setInlineError("Session expired. Please request a new code.");
    return;
  }

  setIsVerifying(true);

  try {
    // ✅ Verify OTP with Firebase
    const result = await confirmation.confirm(code);
    const phoneUser = result?.user;
    if (!phoneUser) throw new Error("OTP verification failed - no user object returned");

    if (!userInfo?.uid) throw new Error("No UID available in userInfo");

    // ✅ Update only the phone field in Firestore
    await firestore().collection("users").doc(userInfo.uid).set(
      {
        phone: phoneNo,
      },
      { merge: true }
    );

    // ✅ Update Redux userInfo locally
    const updatedUser = {
      ...userInfo,
      phone: phoneNo,
    };
    dispatch(uploadUserinfo(updatedUser));

    // ✅ Update AsyncStorage
    await AsyncStorage.setItem("userinfo", JSON.stringify(updatedUser));

    // ✅ Hide OTP UI
    setShowOtp(false);

    // ✅ Show success
    showSuccessMessage("Phone Verified", "Your phone number has been updated successfully!");

    // ✅ Refresh UI (force re-render)
    // easiest way = trigger a navigation refresh or set a state that re-renders
    // For example:
    // navigation.replace("Profile");  // if using react-navigation
    // OR force state refresh:
    setTimeout(() => {
      // reload current page if needed
    }, 300);

  } catch (error: any) {
    console.error("OTP verification failed:", error);
    let userMessage = "Verification failed. Please try again.";

    switch (error.code) {
      case "auth/invalid-verification-code":
        userMessage = "Invalid OTP code. Please check and try again.";
        break;
      case "auth/session-expired":
      case "auth/code-expired":
        userMessage = "OTP has expired. Please request a new code.";
        break;
      case "auth/too-many-requests":
        userMessage = "Too many attempts. Please try again later.";
        break;
      case "auth/network-request-failed":
        userMessage = "Network error. Please check your connection.";
        break;
    }
    setInlineError(userMessage);
  } finally {
    setIsVerifying(false);
  }
};

  
  const handleKeyPress = (e: any, index: number) => {
    try {
      if (e.nativeEvent.key === 'Backspace') {
        const newDigits = [...otpDigits];

        if (otpDigits[index]) {
          // Clear current digit
          newDigits[index] = '';
          setOtpDigits(newDigits);
        } else if (index > 0) {
          // Move to previous input and clear it
          otpInputs[index - 1].current?.focus();
          newDigits[index - 1] = '';
          setOtpDigits(newDigits);
        }

        // Clear error when user starts editing
        if (inlineError) {
          setInlineError('');
        }
      }
    } catch (error) {
      logWithTimestamp('ERROR', 'Error handling key press', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <LinearGradient
          colors={isDarkMode ? ['#1E293B', '#334155'] : ['#4A90E2', '#2E5BDA']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Home', { screen: 'Discover' })}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Profile</Text>
            <View style={styles.headerSpacer} />
          </View>
        </LinearGradient>

        <View
          style={{
            height: userInfo?.uid ? RH(550) : RH(650),
            borderTopRightRadius: RW(10),
            borderTopLeftRadius: RW(10),


          }}

        >
          <View
            style={[
              styles.mainContainer,
              {
                backgroundColor: theme.card,
                height: userInfo?.uid ? RH(715) : RH(810),
                elevation: 10,
                shadowColor: theme.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 4.65,
              },
            ]}
          >
            {/* Profile Card */}
            <Animated.View
              style={[
                styles.profileCard,
                cardAnimatedStyle,
                {
                  backgroundColor: theme.card,
                  borderBottomColor: theme.border,
                  height: userInfo?.uid ? RH(135) : RH(300),
                },
              ]}
            >
              {userInfo && userInfo.uid ? (
                <View style={styles.profileCardContent}>
                  <View style={styles.profileImageContainer}>
                    {userInfo?.profileImageUrl ? (
                      <Image
                        style={styles.profileImage}
                        source={{ uri: userInfo.profileImageUrl }}
                        onLoadEnd={() => setImageLoading(false)}
                      />
                    ) : (
                      <View style={styles.profileImagePlaceholder}>
                        <Ionicons name="person" color="#666" size={RFValue(40)} />
                      </View>
                    )}
                    {imageLoading && userInfo?.profileImageUrl && (
                      <ActivityIndicator
                        style={StyleSheet.absoluteFill}
                        size="large"
                        color="#4A90E2"
                      />
                    )}
                    <TouchableOpacity
                      style={styles.cameraButton}
                      onPress={handleProfileImageUpload}
                      activeOpacity={0.8}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <MaterialCommunityIcons name="camera" color="white" size={RFValue(16)} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.profileInfo}>
                    <Text style={[styles.userName, { color: theme.text }]}>
                      {userInfo?.name || 'Hi User'}
                    </Text>
                    {userInfo.email && (
                      <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                        {userInfo?.email}
                      </Text>
                    )}
                    {userInfo.phone && (
                      <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                        +91 {userInfo?.phone}
                      </Text>
                    )}
                  </View>




                  {userInfo.phoneAuth ? (
                    <TouchableOpacity
                      disabled={!!(userInfo.name && userInfo.phone && userInfo.email)} // disables if all are present
                      onPress={() =>
                        userInfo.phoneAuth ? setShowSuccessModal(true) : handleEditProfile()
                      }
                    >
                      <Image
                        source={require('../assets/google.jpg')}
                        style={{ height: 40, width: 48, borderRadius: 40, display: userInfo.name && userInfo.phone && userInfo.email ? "none" : "flex" }}
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.editButton,
                        {  display: userInfo.name && userInfo.phone && userInfo.email ? "none" : "flex" },
                      ]}
                      disabled={!!(userInfo.name && userInfo.phone && userInfo.email)} // disables if all are present
                      onPress={() =>
                        userInfo.phoneAuth ? onGoogleButtonPress(userInfo) : handleEditProfile()
                      }
                    >
                      <FontAwesome name="phone-square" color="#0F70FF" size={36} />
                    </TouchableOpacity>
                  )}


                </View>

              ) : (
                <View style={styles.loginCardContent}>
                  <Ionicons name="person-circle-outline" color={theme.primary} size={RFValue(64)} />
                  <Text style={[styles.loginTitle, { color: theme.text }]}>Welcome to Coindesi</Text>
                  <Text style={[styles.loginSubtitle, { color: theme.textSecondary }]}>
                    Sign in to access your profile
                  </Text>
                  <TouchableOpacity
                    style={[styles.loginButton, { backgroundColor: theme.primary }]}
                    onPress={() => (navigation as any).navigate('Login')}
                  >
                    <Text style={[styles.loginButtonText, { fontFamily: "lato.medium" }]}>Login</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* Menu Options */}
            <Animated.View style={[styles.menuContainer, cardAnimatedStyle, { backgroundColor: theme.card }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => (navigation as any).navigate('Liked')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="bookmark-outline" size={24} color={theme.text} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Saved Stories</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => (navigation as any).navigate('Events')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="calendar-outline" size={24} color={theme.text} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Events</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </Animated.View>

            <View style={[styles.menuSeparator, { backgroundColor: theme.border }]} />

            {/* Settings with Toggles */}
            <View style={[styles.settingsContainer, { backgroundColor: theme.card }]}>
              <View style={styles.settingItem}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="notifications-outline" size={24} color={theme.text} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Push notifications</Text>
                </View>
                <Switch
                  value={pushNotifications}
                  onValueChange={handlePushNotificationToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="white"
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="moon-outline" size={24} color={theme.text} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Dark mode</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={handleThemeToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="white"
                />
              </View>
            </View>

            <View style={[styles.menuSeparator, { backgroundColor: theme.border }]} />

            {/* Additional Menu */}
            <Animated.View style={[styles.menuContainer, cardAnimatedStyle, { backgroundColor: theme.card }]}>
              <TouchableOpacity style={styles.menuItem} onPress={handleTermandCondition}>
                <View style={styles.menuItemLeft} >
                  <Ionicons name="document-text" size={24} color={theme.text} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Terms and Conditions</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyandPolicy}>
                <View style={styles.menuItemLeft}>
                  <MaterialIcons name="privacy-tip" size={24} color={theme.text} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Privacy & Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>


            </Animated.View>

            {userInfo && userInfo.uid ? (
              <>
                <TouchableOpacity style={styles.logoutButton} onPress={() => setLogoutModalVisible(true)}>
                  <Ionicons name="exit-outline" size={24} color="#EF4444" />
                  <Text style={[styles.logoutText, { color: '#EF4444' }]}>Logout</Text>
                </TouchableOpacity>
                <LogoutModal
                  visible={logoutModalVisible}
                  onConfirm={() => {
                    setLogoutModalVisible(false);
                    handleLogout();
                  }}
                  onCancel={() => setLogoutModalVisible(false)}
                  theme={theme}
                />
              </>
            ) : null}

            {/* Footer Links */}
            <View style={styles.footerContainer}>
              <TouchableOpacity style={styles.footerLink}>
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>Version 1.0.0 </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Edit Profile Modal */}
        <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={handleCancelEdit}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
                <TouchableOpacity onPress={handleCancelEdit}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>

                {userInfo.googleAuth && (
                  <View style={styles.phoneInputRow}>

                    <TouchableOpacity
                      style={[styles.countryCodeButton, {
                        borderColor: theme.border,
                        backgroundColor: theme.card
                      }]}
                      onPress={() => setShowModal(true)}
                    >
                      <Text style={[styles.countryCodeText, { color: theme.text }]}>{selectedCode}</Text>
                      <Ionicons name="chevron-down" size={16} color={theme.text} />
                    </TouchableOpacity>
                    <TextInput
                      value={phoneNo}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setPhoneNo(cleaned);

                        if (cleaned.length === 10) {
                          Keyboard.dismiss();   // ✅ close keyboard when 10 digits entered
                        }
                      }}
                      style={[
                        styles.phoneInput,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.card,
                          color: theme.text,
                        },
                      ]}
                      placeholder="Enter phone number"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                )}

                {otpSuccess && (
                  <View >
                    <Text style={[styles.otpSuccessText]}>OTP sent successfully,please check your phone</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalFooter}>
                <Button title="Cancel" onPress={handleCancelEdit} variant="outline"
                  size="small" style={styles.modalButton}
                  textStyle={{
                    fontFamily: 'lato.medium',   // custom font family
                    fontWeight: '400',    // bold
                    fontSize: 14          // optional font size
                  }} />
                <Button
                  title={otpLoading ? "Sending  OTP..." : "Send OTP"}
                  onPress={() => {
                    handleSendOtp();
                  }}
                  loading={isUpdating}
                  disabled={isUpdating}
                  size="small"
                  style={styles.modalButton}
                  textStyle={{
                    fontFamily: 'lato.medium',   // custom font family
                    fontWeight: '400',           // weight
                    fontSize: 14                 // optional font size
                  }}
                />

              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showOtp}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOtp(false)}
        >
          <View style={styles.alertOverlay}>
            <View style={[styles.alertContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.alertTitle, { color: theme.text }]}>
                Enter 6-digit OTP
              </Text>

              {/* OTP Input Boxes */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 20 }}>
                {otpDigits.map((digit, idx) => (
                  <View key={idx} style={styles.otpInputWrapper}>
                    <TextInput
                      ref={otpInputs[idx]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, idx)}
                      onKeyPress={(e) => handleKeyPress(e, idx)}
                      style={{
                        width: 40,
                        height: 50,
                        borderWidth: 1,
                        borderColor: theme.textSecondary,
                        borderRadius: 8,
                        textAlign: "center",
                        fontSize: 20,
                        color: theme.text,
                        marginHorizontal: 4,
                      }}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectionColor={theme.primary}
                      textContentType="oneTimeCode"   // iOS autofill
                      autoComplete="sms-otp"          // Android autofill
                      importantForAutofill="yes"      // Android autofill priority
                    />
                  </View>
                ))}
              </View>

              {inlineError ? <Text style={[styles.errorText, { color: theme.error }]}>{inlineError}</Text> : null}

              <TouchableOpacity
                style={[styles.resendContainer, !canResend && styles.resendContainerDisabled]}
                onPress={handleResendOtp}
                disabled={isResending || !canResend}
              >
                <Text style={[styles.resendText, { color: canResend ? theme.primary : theme.textSecondary }]}>
                  {canResend ? (isResending ? 'Resending...' : 'Resend Code') : `Resend in ${resendTimer}s`}
                </Text>
              </TouchableOpacity>

              {/* Verify Button */}
              <Button
                title={isVerifying ? "Verify..." : "Verify"}
                onPress={() => handleVerifyOtp(userInfo)}

              />
            </View>
          </View>
        </Modal>


        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.alertOverlay}>
            <View style={[styles.alertContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.alertTitle, { color: theme.text }]}>
                Add your Google Account
              </Text>

              <Button
                title="Authorise with google"
                onPress={() => {
                  setShowSuccessModal(false);      // ✅ always close modal first
                  onGoogleButtonPress(userInfo);   // then run Google sign-in
                }}
              />
            </View>
          </View>
        </Modal>


        {/* Success Alert */}
        {showSuccessAlert && (
          <Animated.View style={[styles.successAlertOverlay, successAlertAnimatedStyle]}>
            <View style={[styles.successAlert, { backgroundColor: theme.card }]}>
              <View style={styles.successIconContainer}>
                <Image source={require('../assets/google.jpg')} style={{ height: 26, width: 28, borderRadius: 40 }} />
              </View>
              <Text style={[styles.successAlertTitle, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.successAlertMessage, { color: theme.textSecondary }]}>{successMessage}</Text>
              <View style={styles.successProgressBar}>
                <View style={styles.successProgressFill} />
              </View>
              <TouchableOpacity style={styles.successCloseButton} onPress={hideSuccessMessage}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        <Modal visible={showModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Country</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={countryCodes}
                keyExtractor={(item, index) => item.code + index}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.countryItem, { borderBottomColor: theme.border }]}
                    onPress={() => {
                      setSelectedCode(item.dialCode);
                      setShowModal(false);
                    }}
                  >
                    <Text style={[styles.countryName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.countryCode, { color: theme.textSecondary }]}>{item.dialCode}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Login Prompt Modal */}
        <LoginPrompt
          visible={showLoginPrompt}
          onClose={() => setShowLoginPrompt(false)}
          title="You need to log in to continue"
          message="Please sign in to upload profile images and access all features."
          isDarkMode={isDarkMode}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: RW(20),
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',

  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: RW(16),
    borderBottomWidth: 1,
  },
  countryName: {
    fontSize: RFValue(16),
  },
  countryCode: {
    fontSize: RFValue(14),
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: RW(12),
  },

  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RW(12),
    paddingVertical: RH(18),
    borderWidth: 1,
    borderRadius: 8,
    minWidth: RW(80),
  },
  countryCodeText: {
    fontSize: RFValue(16),
    fontWeight: '400',
    fontFamily: "Inter_28pt-Regular"
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: RW(12),
    paddingVertical: RH(12),
    borderWidth: 1,
    borderRadius: 8,
    fontSize: RFValue(16),
    fontFamily: "Inter_28pt-Regular"
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: RW(8),
  },
  otpInput: {
    flex: 1,
    height: RH(48),
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: RFValue(18),
    fontWeight: '600',
  },

  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: RW(20),
  },
  alertContent: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'white',
    borderRadius: RW(16),
    padding: RW(24),
    width: '100%',
    maxWidth: RW(400),
    maxHeight: '80%',
  },
  alertTitle: {
    alignItems: "center",
    fontSize: RFValue(20),
    fontWeight: '600',
    marginTop: RH(12),
    marginBottom: RH(10),
    textAlign: "center",
    fontFamily: "lato.semibold",
  },
  alertMessage: {
    fontSize: RFValue(16),
    textAlign: 'center',
    marginBottom: RH(20),
    lineHeight: RFValue(22),
  },
  alertButton: {
    minWidth: RW(100),
  },
  container: {
    flex: 1,
  },
  headerGradient: {
    height: RH(250),
    paddingTop: Platform.OS === 'ios' ? RH(50) : RH(100),
    paddingHorizontal: RW(20),
    borderBottomLeftRadius: RW(20),
    borderBottomRightRadius: RW(20),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: RH(20),
    left: RW(5),
    justifyContent: 'space-between',
    flex: 1,
  },
  backButton: {
    width: RW(40),
    height: RH(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: RFValue(22),
    color: 'white',
    flex: 1,
    marginLeft: RW(10),
    fontFamily: "Lato-Regular",
    fontWeight: "500"
  },
  headerSpacer: {
    width: RW(40),
  },
  mainContainer: {
    position: 'absolute',
    width: '90%',
    backgroundColor: 'white',
    marginHorizontal: RW(20),
    borderRadius: RW(15),
    bottom: RH(5),
    borderTopRightRadius: RW(10),
    borderTopLeftRadius: RW(10),
  },
  profileCard: {
    position: 'relative',
    width: '100%',
    padding: RW(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: RW(8),
    elevation: 4,
    borderBottomWidth: 1,
    borderTopLeftRadius: RW(10),
    borderTopRightRadius: RW(10),
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopRightRadius: RW(10),
    borderTopLeftRadius: RW(10),
  },
  loginCardContent: {
    alignItems: 'center',
    paddingVertical: RH(20),
    borderTopRightRadius: RW(10),
    borderTopLeftRadius: RW(10),
  },
  loginTitle: {
    fontSize: RFValue(24),
    fontWeight: '500',
    marginTop: RH(16),
    marginBottom: RH(8),
    fontFamily: "lato.semibold"
  },
  loginSubtitle: {
    fontSize: RFValue(16),
    textAlign: 'center',
    marginBottom: RH(24),
    fontFamily: "lato.medium"

  },
  loginButton: {
    paddingVertical: RH(12),
    paddingHorizontal: RW(24),
    borderRadius: RW(20),
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "Inter_28pt-Regular",
    fontWeight: "400"
  },
  loginButtonText: {
    color: 'white',
    fontSize: RFValue(16),
    fontWeight: '300',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: RW(16),
  },
  profileImage: {
    width: RW(80),
    height: RW(80),
    borderRadius: RW(40),
  },
  profileImagePlaceholder: {
    width: RW(80),
    height: RW(80),
    borderRadius: RW(40),
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: RH(-2),
    right: RW(-2),
    backgroundColor: '#4A90E2',
    borderRadius: RW(15),
    width: RW(30),
    height: RW(30),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: RFValue(20),
    color: '#333',
    marginBottom: RH(4),
    fontFamily: "Lato-Regular",
    fontWeight: "500"
  },
  userEmail: {
    fontSize: RFValue(10),
    color: '#666',
    fontFamily: "Lato-Regular",
    fontWeight: "400"
  },
  editButton: {

    paddingHorizontal: RW(20),
    paddingVertical: RH(8),
    borderRadius: RW(20),

  },
  editButtonText: {
    color: 'white',
    fontSize: RFValue(14),
    fontFamily: "Lato-Regular",
    fontWeight: "400"
  },
  menuContainer: {
    position: 'relative',
    backgroundColor: 'white',
    marginBottom: RH(16),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: RH(16),
    paddingHorizontal: RW(20),
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: RFValue(16),
    color: '#333',
    marginLeft: RW(16),
    fontFamily: "Lato-Regular",
    fontWeight: "500"
  },
  menuSeparator: {
    height: RH(1),
    backgroundColor: '#F0F0F0',
    width: '95%',
    alignSelf: 'center',
  },
  settingsContainer: {
    position: 'relative',
    backgroundColor: 'white',
    borderRadius: RW(16),
    marginBottom: RH(16),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: RH(16),
    paddingHorizontal: RW(20),
  },
  logoutButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: RH(1),
    paddingHorizontal: RW(20),
    marginBottom: RH(30),
  },
  logoutText: {
    fontSize: RFValue(16),
    color: '#EF4444',
    marginLeft: RW(16),
    fontFamily: "lato.medium"
  },
  footerContainer: {
    alignItems: 'center',
    marginBottom: RH(40),
  },
  footerLink: {
    paddingVertical: RH(8),
  },
  footerText: {
    fontSize: RFValue(14),
    color: '#666',
    textAlign: 'center',
    fontFamily: "Lato-Regular",
    fontWeight: "500"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: RW(20),
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: RW(16),
    padding: RW(24),
    width: '100%',
    maxWidth: RW(400),
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: RH(24),
  },
  modalTitle: {
    fontSize: RFValue(20),
    fontWeight: '400',
    color: '#333',
    fontFamily: "lato.semibold"
  },
  modalBody: {
    marginBottom: RH(24),
  },
  inputContainer: {
    marginBottom: RH(16),
  },
  inputLabel: {
    fontSize: RFValue(14),
    fontWeight: '400',
    color: '#333',
    marginBottom: RH(8),
    fontFamily: "lato.medium"
  },
  textInput: {
    borderWidth: 1,
    borderRadius: RW(8),
    paddingHorizontal: RW(12),
    paddingVertical: RH(12),
    fontSize: RFValue(16),
    fontFamily: "lato.medium",
    fontWeight: '400'
  },
  modalFooter: {
    flexDirection: 'row',
    gap: RW(12),
  },
  modalButton: {
    flex: 1,
  },
  successAlertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successAlert: {
    backgroundColor: 'white',
    borderRadius: RW(16),
    padding: RW(24),
    marginHorizontal: RW(20),
    maxWidth: RW(320),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: RH(4) },
    shadowOpacity: 0.25,
    shadowRadius: RW(12),
    elevation: 8,
  },
  successIconContainer: {
    width: RW(60),
    height: RW(60),
    borderRadius: RW(30),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: RH(16),
  },
  successAlertTitle: {
    textAlign: "center",
    fontSize: RFValue(20),
    fontWeight: '600',
    color: '#333',
    fontFamily: "lato.semibold"
  },
  successAlertMessage: {
    fontSize: RFValue(16),
    color: '#666',
    textAlign: 'center',
    lineHeight: RFValue(22),
  },
  successCloseButton: {
    position: 'absolute',
    top: RH(12),
    right: RW(12),
    width: RW(32),
    height: RW(32),
    borderRadius: RW(16),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successProgressBar: {
    width: '100%',
    height: RH(3),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: RW(2),
    marginTop: RH(16),
    overflow: 'hidden',
  },
  successProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: RW(2),
    width: '100%',
  },
});

export default Profilepage;
