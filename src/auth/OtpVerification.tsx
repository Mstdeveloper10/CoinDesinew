import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Keyboard,
  Alert,
  AppState,
} from 'react-native';
import { useNavigation, NavigationProp, ParamListBase, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { saveUserInfoToFirestore } from '../redux/action/userActions';
import Ionicons from 'react-native-vector-icons/Ionicons';
import messaging from '@react-native-firebase/messaging';
import { createTheme ,RH,RW,RFValue } from '../utils/theme';
import Button from '../components/Button';
import firestore from '@react-native-firebase/firestore';
import { UpdateisLoggedin } from '../redux/action/action';
import SmsRetriever from 'react-native-sms-retriever';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

// Enhanced logging utility
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

const OtpVerification = () => {
  const dispatch = useDispatch();
  const route = useRoute();
  const isDarkMode = useSelector((state: any) => state.theme.isDarkMode);
  const theme = createTheme(isDarkMode);

  const { confirmation: initialConfirmation, phoneNumber, selectedCode }: any = route.params || {};
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(
    initialConfirmation || null
  );

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputs = Array.from({ length: 6 }, () => useRef<TextInput>(null));

  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [smsListenerActive, setSmsListenerActive] = useState(false);

  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const otp = otpDigits.join('');

  // Enhanced Timer effect with cleanup
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

  // Enhanced SMS Auto-fill with better error handling
  useEffect(() => {
    let smsListener: any = null;

    const setupSmsRetriever = async () => {
      if (Platform.OS !== 'android') {
        logWithTimestamp('INFO', 'SMS Retriever not available on iOS, using native autofill');
        return;
      }

      try {
        logWithTimestamp('INFO', 'Starting SMS Retriever setup');
        
        // Start SMS Retriever
        const isStarted = await SmsRetriever.startSmsRetriever();
        logWithTimestamp('INFO', 'SMS Retriever started', { isStarted });

        // Add SMS listener
        smsListener = SmsRetriever.addSmsListener((event) => {
          try {
            logWithTimestamp('INFO', 'SMS Event received', { event });

            if (!event || !event.message) {
              logWithTimestamp('WARN', 'SMS event is empty or missing message');
              return;
            }

            // Multiple regex patterns to catch different OTP formats
            const otpPatterns = [
              /(\d{6})/,                           // 6 consecutive digits
              /code[:\s]*(\d{6})/i,               // "code: 123456" or "code 123456"
              /otp[:\s]*(\d{6})/i,                // "otp: 123456" or "otp 123456"
              /verification[:\s]*(\d{6})/i,       // "verification: 123456"
              /(\d{6})[^\d]/,                     // 6 digits followed by non-digit
            ];

            let extractedOtp = null;
            for (const pattern of otpPatterns) {
              const match = event.message.match(pattern);
              if (match && match[1]) {
                extractedOtp = match[1];
                logWithTimestamp('INFO', 'OTP extracted using pattern', { pattern: pattern.toString(), otp: extractedOtp });
                break;
              }
            }

            if (extractedOtp) {
              handleAutoFilledOtp(extractedOtp);
            } else {
              logWithTimestamp('WARN', 'No OTP found in SMS message', { message: event.message });
            }

          } catch (error) {
            logWithTimestamp('ERROR', 'Error processing SMS event', error);
          }
        });

        setSmsListenerActive(true);
        logWithTimestamp('INFO', 'SMS listener added successfully');

      } catch (error) {
        logWithTimestamp('ERROR', 'Failed to setup SMS Retriever', error);
      }
    };

    setupSmsRetriever();

    // Cleanup function
    return () => {
      try {
        if (smsListener && Platform.OS === 'android') {
          SmsRetriever.removeSmsListener();
          logWithTimestamp('INFO', 'SMS listener removed');
        }
        setSmsListenerActive(false);
      } catch (error) {
        logWithTimestamp('ERROR', 'Error removing SMS listener', error);
      }
    };
  }, []);

  // App state listener to handle app coming to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && Platform.OS === 'android' && !smsListenerActive) {
        logWithTimestamp('INFO', 'App became active, restarting SMS listener');
        // Restart SMS listener if it's not active
        // This is handled by the main useEffect above
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [smsListenerActive]);

  // Enhanced auto-fill handler
  const handleAutoFilledOtp = (code: string) => {
    try {
      logWithTimestamp('INFO', 'Processing auto-filled OTP', { code });
      
      if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        logWithTimestamp('WARN', 'Invalid OTP format from auto-fill', { code, length: code.length });
        return;
      }

      const digits = code.split('');
      setOtpDigits(digits);
      setInlineError(''); // Clear any existing errors

      // Auto-verify after a short delay
      setTimeout(() => {
        logWithTimestamp('INFO', 'Auto-verifying OTP from SMS');
        handleVerifyOtp(code);
      }, 500);

    } catch (error) {
      logWithTimestamp('ERROR', 'Error handling auto-filled OTP', error);
    }
  };

  // Enhanced OTP verification with better error handling
  const handleVerifyOtp = async (manualOtp?: string) => {
    const startTime = Date.now();
    logWithTimestamp('INFO', 'Starting OTP verification', { manualOtp: !!manualOtp });
    
    setInlineError('');
    const code = manualOtp || otpDigits.join('');

    // Input validation
    if (code.length !== 6) {
      const error = 'Please enter all 6 digits.';
      setInlineError(error);
      logWithTimestamp('WARN', 'OTP verification failed - incomplete code', { codeLength: code.length });
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      const error = 'Please enter only numbers.';
      setInlineError(error);
      logWithTimestamp('WARN', 'OTP verification failed - invalid format', { code });
      return;
    }

    if (!confirmation) {
      const error = 'Session expired. Please request a new code.';
      setInlineError(error);
      logWithTimestamp('ERROR', 'OTP verification failed - no confirmation object');
      return;
    }

    setIsVerifying(true);

    try {
      logWithTimestamp('INFO', 'Confirming OTP with Firebase');
      const result = await confirmation.confirm(code);
      const user = result?.user;

      if (!user) {
        throw new Error('User authentication failed - no user object returned');
      }

      logWithTimestamp('INFO', 'OTP verified successfully', { uid: user.uid });

      // Get FCM token with error handling
      let fcmToken = '';
      try {
        fcmToken = await messaging().getToken();
        logWithTimestamp('INFO', 'FCM token retrieved', { hasToken: !!fcmToken });
      } catch (fcmError) {
        logWithTimestamp('ERROR', 'Failed to get FCM token', fcmError);
        // Continue without FCM token - it's not critical for authentication
      }

      // Enhanced Firestore operations with better error handling
      logWithTimestamp('INFO', 'Updating user data in Firestore');
      const userQuery = await firestore()
        .collection('users')
        .where('phone', '==', phoneNumber)
        .limit(1)
        .get();

      let userData;
      const timestamp = firestore.FieldValue.serverTimestamp();

      if (!userQuery.empty) {
        // Update existing user
        const existingUser = userQuery.docs[0].data();
        userData = {
          ...existingUser,
          uid: user.uid, // Ensure UID is updated
          fcmToken: fcmToken || existingUser.fcmToken || '',
          lastLoginAt: timestamp,
          phoneAuth: true,
        };

        const docRef = userQuery.docs[0].ref;
        await docRef.update({
          fcmToken: fcmToken || existingUser.fcmToken || '',
          lastLoginAt: timestamp,
          phoneAuth: true,
          uid: user.uid,
        });

        logWithTimestamp('INFO', 'Existing user updated in Firestore');
      } else {
        // Create new user
        userData = {
          uid: user.uid,
          phone: phoneNumber,
          phoneAuth: true,
          googleAuth: false,
          fcmToken: fcmToken || '',
          createdAt: timestamp,
          lastLoginAt: timestamp,
        };

        await firestore()
          .collection('users')
          .doc(user.uid)
          .set(userData);

        logWithTimestamp('INFO', 'New user created in Firestore');
      }

      // Dispatch actions
      await dispatch(saveUserInfoToFirestore(userData) as any);
      dispatch(UpdateisLoggedin(true));

      const duration = Date.now() - startTime;
      logWithTimestamp('INFO', 'OTP verification completed successfully', { duration: `${duration}ms` });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logWithTimestamp('ERROR', 'OTP verification failed', { 
        error: error.message, 
        code: error.code,
        duration: `${duration}ms`
      });

      // Enhanced error handling with specific messages
      let userMessage = 'Verification failed. Please try again.';

      switch (error.code) {
        case 'auth/invalid-verification-code':
          userMessage = 'Invalid OTP code. Please check and try again.';
          break;
        case 'auth/session-expired':
        case 'auth/code-expired':
          userMessage = 'OTP has expired. Please request a new code.';
          break;
        case 'auth/too-many-requests':
          userMessage = 'Too many attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          userMessage = 'Network error. Please check your connection.';
          break;
        case 'auth/invalid-phone-number':
          userMessage = 'Invalid phone number. Please try again.';
          break;
        default:
          if (error.message.includes('network')) {
            userMessage = 'Network error. Please check your connection and try again.';
          } else if (error.message.includes('timeout')) {
            userMessage = 'Request timed out. Please try again.';
          }
          break;
      }

      setInlineError(userMessage);
      
      // Show modal for critical errors
      if (['auth/session-expired', 'auth/code-expired'].includes(error.code)) {
        setErrorModalMessage('Your verification session has expired. You will need to request a new code.');
        setShowErrorModal(true);
      }

    } finally {
      setIsVerifying(false);
    }
  };

  // Enhanced resend OTP with better error handling
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

  // Enhanced OTP input handler
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

  // Handle pasted OTP
  const handlePastedOtp = (pastedText: string, startIndex: number) => {
    try {
      const digits = pastedText.slice(0, 6).split('');
      const newDigits = [...otpDigits];

      // Fill from the current index
      for (let i = 0; i < digits.length && (startIndex + i) < 6; i++) {
        newDigits[startIndex + i] = digits[i];
      }

      setOtpDigits(newDigits);

      // Focus the last filled input or next empty one
      const lastFilledIndex = Math.min(startIndex + digits.length - 1, 5);
      if (lastFilledIndex < 5) {
        otpInputs[lastFilledIndex + 1].current?.focus();
      } else {
        Keyboard.dismiss();
      }

      // Auto-verify if complete
      if (newDigits.every(d => d)) {
        setTimeout(() => {
          handleVerifyOtp(newDigits.join(''));
        }, 200);
      }

    } catch (error) {
      logWithTimestamp('ERROR', 'Error handling pasted OTP', error);
    }
  };

  // Enhanced backspace handler
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

  // Component cleanup
  useEffect(() => {
    return () => {
      logWithTimestamp('INFO', 'OTP Verification component unmounting');
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} scrollEnabled={false}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]}>Enter Code</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              We have sent you an SMS with the code{'\n'}
              to {phoneNumber}
            </Text>
           
          </View>

          <View style={styles.otpContainer}>
            {otpDigits.map((digit, idx) => (
              <View key={idx} style={styles.otpInputWrapper}>
                <TextInput
                  ref={otpInputs[idx]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  style={[
                    styles.otpInput,
                    {
                      borderColor: digit ? theme.primary : theme.border,
                      backgroundColor: theme.card,
                      color: theme.text,
                    },
                  ]}
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

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: theme.primary, opacity: isVerifying ? 0.7 : 1 }]}
            onPress={() => handleVerifyOtp()}
            disabled={isVerifying || otp.length !== 6}
          >
            <Text style={[styles.doneButtonText, { color: theme.card }]}>
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.alertModal, { backgroundColor: theme.card }]}>
            <Ionicons name="close-circle" size={32} color={theme.error} />
            <Text style={[styles.alertTitle, { color: theme.error }]}>Error</Text>
            <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>{errorModalMessage}</Text>
            <Button title="OK" onPress={() => setShowErrorModal(false)} style={styles.alertButton} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: RW(20) },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: RH(25) },
  backButton: { width: RW(40), height: RW(40), borderRadius: RW(20), justifyContent: 'center', alignItems: 'center' },
  titleContainer: { alignItems: 'center', marginBottom: RH(40), marginTop: RH(120) },
  title: { fontSize: RFValue(24), fontWeight: '500', marginBottom: RH(8), fontFamily: "Lato-Bold" },
  subtitle: { fontSize: RFValue(16), textAlign: 'center', lineHeight: RFValue(22), fontFamily: "Lato-Regular" },
  autoFillHint: { fontSize: RFValue(12), textAlign: 'center', marginTop: RH(8), fontStyle: 'italic' },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: RH(30) },
  otpInputWrapper: { width: RW(50), height: RW(50), padding: 0 },
  otpInput: { width: '100%', height: '100%', borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: RFValue(20), fontWeight: '600' },
  errorText: { fontSize: RFValue(14), textAlign: 'center', marginBottom: RH(20) },
  resendContainer: { alignItems: 'center', marginBottom: RH(10) },
  resendText: { fontSize: RFValue(16), fontWeight: '700', fontFamily: "Inter_28pt-Regular" },
  resendContainerDisabled: { opacity: 0.5 },
  doneButton: { padding: RW(16), borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  doneButtonText: { fontSize: RFValue(16), fontWeight: '500', fontFamily: "Lato-Regular" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: RW(20) },
  alertModal: { borderRadius: 16, padding: RW(24), width: '100%', maxWidth: RW(320), alignItems: 'center' },
  alertTitle: { fontSize: RFValue(20), fontWeight: '700', marginBottom: RH(8) },
  alertMessage: { fontSize: RFValue(16), textAlign: 'center', marginBottom: RH(24), lineHeight: RFValue(24) },
  alertButton: { minWidth: RW(120) },
});

export default OtpVerification;


