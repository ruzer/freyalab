import { mount } from 'svelte'
import App from './App.svelte'
import './style.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import 'katex/dist/katex.min.css'
document.documentElement.classList.toggle('macos',navigator.platform.startsWith('Mac'))
mount(App, { target: document.getElementById('app')! })
