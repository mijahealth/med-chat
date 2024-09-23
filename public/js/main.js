// public/js/main.js
import { initializeApp } from './ui.js';
import feather from 'feather-icons';

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  feather.replace();
});