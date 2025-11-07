import { Outlet } from "react-router";
import "./App.css";
// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import Navbar from "./components/Navbaar";
import { ThemeProvider } from "./Theme";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7qCJsDWu0DJhcn16Dhz845lNzhaSkMO4",
  authDomain: "ai-projects-demo.firebaseapp.com",
  projectId: "ai-projects-demo",
  storageBucket: "ai-projects-demo.firebasestorage.app",
  messagingSenderId: "16837505975",
  appId: "1:16837505975:web:51f52420a4caadb1ea6e32",
  measurementId: "G-J5J5GFBCVG",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

function App() {
  console.log(analytics);
  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Navbar />
        <Outlet />
      </ThemeProvider>
    </>
  );
}

export default App;

// const LANGUAGES = {
//   "Acehnese (Arabic script)": "ace_Arab",
//   "Acehnese (Latin script)": "ace_Latn",
//   Afrikaans: "afr_Latn",
//   hindi: "hin_Deva",
//   Zulu: "zul_Latn",
//   english: "eng_Latn",
//   french: "fra_Latn",
//   german: "deu_Latn",
//   spanish: "spa_Latn",
//   italian: "ita_Latn",
//   japanese: "jpn_Jpan",
//   korean: "kor_Hang",
//   "chinese (simplified)": "cmn_Hans",
//   "chinese (traditional)": "cmn_Hant",
//   // Add more languages as needed
// };

// type LanguageSelectorProps = {
//   type: string;
//   onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
//   defaultLanguage: string;
// };

// function LanguageSelector({
//   type,
//   onChange,
//   defaultLanguage,
// }: LanguageSelectorProps) {
//   return (
//     <div className="language-selector">
//       <label>{type}: </label>
//       <select onChange={onChange} defaultValue={defaultLanguage}>
//         {Object.entries(LANGUAGES).map(([key, value]) => {
//           return (
//             <option key={key} value={value as string}>
//               {key}
//             </option>
//           );
//         })}
//       </select>
//     </div>
//   );
// }
// type ProgressProps = {
//   text: string;
//   percentage?: number;
// };

// function ProgressCustom({ text, percentage = 0 }: ProgressProps) {
//   return (
//     <div className="progress-container">
//       {text} ({`${percentage.toFixed(2)}%`})
//       <Progress value={percentage} />
//     </div>
//   );
// }
