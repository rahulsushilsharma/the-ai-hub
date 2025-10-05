import { Outlet } from "react-router";
import "./App.css";

function App() {
  return (
    <>
      <Outlet />
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
