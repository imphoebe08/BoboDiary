import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// 您的 Firebase 設定檔
const firebaseConfig = {
  apiKey: "AIzaSyD4eivlrnDfwfjuO6Fh8tibPwgeAqh77JU",
  authDomain: "bobodiary-4140e.firebaseapp.com",
  projectId: "bobodiary-4140e",
  storageBucket: "bobodiary-4140e.firebasestorage.app",
  messagingSenderId: "583414719403",
  appId: "1:583414719403:web:9e0751451cb113927da8ee",
  measurementId: "G-7KY8V1GSBB"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 取得共用資料庫的 ID (確保有登入即可，家人共用同一個資料庫)
const getUid = () => {
  const user = auth.currentUser;
  if (!user) throw new Error("請先登入");
  // 改為回傳固定的名稱，讓所有登入的家人都讀寫同一個資料夾
  return "shared_family_database";
};

export const api = {
  // 帳號驗證 API
  auth: {
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback)
  },

  // 行事曆 API
  getEvents: async () => {
    const snapshot = await getDocs(collection(db, 'users', getUid(), 'events'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  addEvent: async (event) => {
    await addDoc(collection(db, 'users', getUid(), 'events'), event);
  },
  updateEvent: async (id, updatedEvent) => {
    await updateDoc(doc(db, 'users', getUid(), 'events', id), updatedEvent);
  },
  deleteEvent: async (id) => {
    await deleteDoc(doc(db, 'users', getUid(), 'events', id));
  },
  
  // 行事曆設定 (類別)
  getCalendarSettings: async () => {
    const d = await getDoc(doc(db, 'users', getUid(), 'settings', 'calendar'));
    if (d.exists()) return d.data();
    return { categories: ['就醫', '驅蟲藥', '洗澡', '美容', '其他'] }; // 預設值
  },
  saveCalendarSettings: async (settings) => {
    await setDoc(doc(db, 'users', getUid(), 'settings', 'calendar'), settings);
  },

  // 飲食與用藥 API
  getLogs: async () => {
    const snapshot = await getDocs(collection(db, 'users', getUid(), 'logs'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  addLog: async (log) => {
    await addDoc(collection(db, 'users', getUid(), 'logs'), log);
  },
  updateLog: async (id, updatedLog) => {
    await updateDoc(doc(db, 'users', getUid(), 'logs', id), updatedLog);
  },
  deleteLog: async (id) => {
    await deleteDoc(doc(db, 'users', getUid(), 'logs', id));
  },
  
  // 飲食與用藥設定 (類別、品牌)
  getDietSettings: async () => {
    const d = await getDoc(doc(db, 'users', getUid(), 'settings', 'diet'));
    if (d.exists()) return d.data();
    return { categories: ['飼料', '用藥', '保健品'], brands: ['全能狗S', '心絲蟲藥'] };
  },
  saveDietSettings: async (settings) => {
    await setDoc(doc(db, 'users', getUid(), 'settings', 'diet'), settings);
  },

  // 體重 API
  getWeights: async () => {
    const snapshot = await getDocs(collection(db, 'users', getUid(), 'weights'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  addWeight: async (weight) => {
    await addDoc(collection(db, 'users', getUid(), 'weights'), weight);
  },
  updateWeight: async (id, updatedWeight) => {
    await updateDoc(doc(db, 'users', getUid(), 'weights', id), updatedWeight);
  },
  deleteWeight: async (id) => {
    await deleteDoc(doc(db, 'users', getUid(), 'weights', id));
  },

  // 血檢 API
  getBloodTests: async () => {
    const snapshot = await getDocs(collection(db, 'users', getUid(), 'bloodtests'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  addBloodTest: async (test) => {
    await addDoc(collection(db, 'users', getUid(), 'bloodtests'), test);
  },
  updateBloodTest: async (id, updatedTest) => {
    await updateDoc(doc(db, 'users', getUid(), 'bloodtests', id), updatedTest);
  },
  deleteBloodTest: async (id) => {
    await deleteDoc(doc(db, 'users', getUid(), 'bloodtests', id));
  },
  
  // 血檢設定 (醫院清單、追蹤指標)
  getBloodTestSettings: async () => {
    const d = await getDoc(doc(db, 'users', getUid(), 'settings', 'bloodtest'));
    if (d.exists()) return d.data();
    return { 
      clinics: ['波波動物醫院'], 
      metrics: [{name:'BUN', min:'', max:''}, {name:'CREA', min:'', max:''}, {name:'WBC', min:'', max:''}, {name:'ALT', min:'', max:''}, {name:'ALKP', min:'', max:''}] 
    };
  },
  saveBloodTestSettings: async (settings) => {
    await setDoc(doc(db, 'users', getUid(), 'settings', 'bloodtest'), settings);
  }
};