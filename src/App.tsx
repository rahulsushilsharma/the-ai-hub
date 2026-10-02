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
  apiKey: "AIzaSyCiHfxW8UwhMxFOLXw8S_3UP7vps8fJg-0",
  authDomain: "rahul-sushil-sharma.firebaseapp.com",
  projectId: "rahul-sushil-sharma",
  storageBucket: "rahul-sushil-sharma.firebasestorage.app",
  messagingSenderId: "817826509214",
  appId: "1:817826509214:web:caf4203b380d2b39c4a68f",
  measurementId: "G-MLR789TV0J",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

function App() {
  console.log(analytics);
  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Navbar />
        <div id="main" tabIndex={-1} className="outline-none">
          <Outlet />
        </div>
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
