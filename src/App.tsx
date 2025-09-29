import { pipeline } from '@huggingface/transformers';
import { useEffect, useRef, useState } from 'react';
import './App.css';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';



function App() {
  const [count, setCount] = useState(0)
  const [ready, setReady] = useState(false);
  const [disabled, setDisabled] = useState(false);
  type ProgressItem = { file: string; progress?: number; status?: string };
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

  // Inputs and outputs
  const [input, setInput] = useState('I love walking my dog.');
  const [sourceLanguage, setSourceLanguage] = useState('eng_Latn');
  const [targetLanguage, setTargetLanguage] = useState('fra_Latn');
  const [output, setOutput] = useState('');
  async function run() {
    const classifier = await pipeline('sentiment-analysis');
    const output = await classifier('we love you');
    console.log(output);
  }
  const translate = () => {
    setDisabled(true);
    if (worker.current) {
      worker.current.postMessage({
        text: input,
        src_lang: sourceLanguage,
        tgt_lang: targetLanguage,
      });
    }
  }
  useEffect(() => {
    run();
  }, []);

  const worker = useRef<Worker | null>(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.status) {
        case 'initiate':
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems(prev => [...prev, e.data]);
          break;

        case 'progress':
          // Model file progress: update one of the progress items.
          setProgressItems(
            prev => prev.map(item => {
              if (item.file === e.data.file) {
                return { ...item, progress: e.data.progress }
              }
              return item;
            })
          );
          break;

        case 'done':
          // Model file loaded: remove the progress item from the list.
          setProgressItems(
            prev => prev.filter(item => item.file !== e.data.file)
          );
          break;

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;

        case 'update':
          // Generation update: update the output text.
          console.log(e.data.output);
          setOutput(e.data.output[0].translation_text);
          break;

        case 'complete':
          // Generation complete: re-enable the "Translate" button
          setOutput(e.data.output[0].translation_text);
          console.log(e.data.output[0].translation_text);
          setDisabled(false);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => { if (worker.current) worker.current.removeEventListener('message', onMessageReceived); }
  }, []);



  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count: number) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <h1>Transformers.js</h1>
      <h2>ML-powered multilingual translation in React!</h2>

      <div className='container'>
        <div className='language-container'>
          <LanguageSelector type={"Source"} defaultLanguage={"eng_Latn"} onChange={x => setSourceLanguage(x.target.value)} />
          <LanguageSelector type={"Target"} defaultLanguage={"fra_Latn"} onChange={x => setTargetLanguage(x.target.value)} />
        </div>

        <div className='textbox-container'>
          <textarea value={input} rows={3} onChange={e => setInput(e.target.value)}></textarea>
          <textarea value={output} rows={3} readOnly></textarea>
        </div>
      </div>

      <button disabled={disabled} onClick={translate}>Translate</button>

      <div className='progress-bars-container'>
        {ready === false && (
          <label>Loading models... (only run once)</label>
        )}
        {progressItems.map(data => (
          <div key={data.file}>
            <Progress text={data.file} percentage={data.progress} />
          </div>
        ))}
      </div>
    </>
  )
}

export default App
const LANGUAGES = {
  "Acehnese (Arabic script)": "ace_Arab",
  "Acehnese (Latin script)": "ace_Latn",
  "Afrikaans": "afr_Latn",
  "hindi": "hin_Deva",
  "Zulu": "zul_Latn",
  "english": "eng_Latn",
  "french": "fra_Latn",
  "german": "deu_Latn",
  "spanish": "spa_Latn",
  "italian": "ita_Latn",
  "japanese": "jpn_Jpan",
  "korean": "kor_Hang",
  "chinese (simplified)": "cmn_Hans",
  "chinese (traditional)": "cmn_Hant",
  // Add more languages as needed
}

type LanguageSelectorProps = {
  type: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  defaultLanguage: string;
};

function LanguageSelector({ type, onChange, defaultLanguage }: LanguageSelectorProps) {
  return (
    <div className='language-selector'>
      <label>{type}: </label>
      <select onChange={onChange} defaultValue={defaultLanguage}>
        {Object.entries(LANGUAGES).map(([key, value]) => {
          return <option key={key} value={value as string}>{key}</option>
        })}
      </select>
    </div>
  )
}
type ProgressProps = {
  text: string;
  percentage?: number;
};

function Progress({ text, percentage = 0 }: ProgressProps) {
  return (
    <div className="progress-container">
      <div className='progress-bar' style={{ 'width': `${percentage}%` }}>
        {text} ({`${percentage.toFixed(2)}%`})
      </div>
    </div>
  );
}