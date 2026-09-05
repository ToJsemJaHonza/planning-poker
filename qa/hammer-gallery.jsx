import React from 'react';
import { createRoot } from 'react-dom/client';
import HammerGallery from './HammerGallery';
import '../src/index.css';
import './hammer-gallery.css';

const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<React.StrictMode><HammerGallery /></React.StrictMode>);
