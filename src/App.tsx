import React, { useState, useRef } from 'react';
import { useEffect } from 'react';
import { Upload, Image as ImageIcon, Link as LinkIcon, Settings2, Copy, Check, AlertCircle, RefreshCw, Trash2, Globe, FileImage, ImagePlus, Pause, Play, Filter, LayoutGrid, List, Type, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY || '';

type UploadItem = {
  id: string;
  source: 'file' | 'url';
  file?: File;
  originalUrl?: string;
  url?: string;
  thumbUrl?: string;
  status: 'idle' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
  name: string;
};

type Position = 'tl'|'tc'|'tr'|'cl'|'cc'|'cr'|'bl'|'bc'|'br'|'tile';

export interface Watermark {
  id: string;
  type: 'image' | 'text';
  url?: string;
  text?: string;
  color?: string;
  opacity: number;
  position: Position;
  size: number;
  padding: number;
  rotation?: number;
  gap?: number;
  fontFamily?: string;
}

const FONT_FAMILIES = [
  { value: 'sans-serif', label: 'Default (Sans-serif)' },
  { value: 'serif', label: 'Cổ điển (Serif)' },
  { value: 'monospace', label: 'Code (Monospace)' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' }
];

const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
  const button = event.currentTarget;
  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
  circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
  circle.classList.add("ripple");

  const ripple = button.getElementsByClassName("ripple")[0];
  if (ripple) {
    ripple.remove();
  }

  button.appendChild(circle);
};

const processImage = async (
  imageUrl: string, 
  width: number, 
  format: string, 
  quality: number,
  watermarks: Watermark[],
  imageFilter: string = 'none'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      const aspectRatio = img.width / img.height;
      let finalWidth = img.width;
      let finalHeight = img.height;

      if (width > 0 && width < img.width) {
        finalWidth = width;
        finalHeight = width / aspectRatio;
      }
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      
      if (imageFilter && imageFilter !== 'none') {
        ctx.filter = imageFilter;
      }
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
      ctx.filter = 'none';

      if (watermarks && watermarks.length > 0) {
        for (const wm of watermarks) {
          ctx.save();
          ctx.globalAlpha = wm.opacity / 100;
          
          if (wm.type === 'image' && wm.url) {
            await new Promise<void>((resolveWM) => {
              const wmImg = new Image();
              wmImg.onload = () => {
                let wmWidth = finalWidth * (wm.size / 100);
                let wmHeight = wmImg.height * (wmWidth / wmImg.width);
                const margin = finalWidth * (wm.padding / 100);
                
                if (wm.position === 'tile') {
                  const stepX = wmWidth + (wm.gap || 20) * (finalWidth / 100);
                  const stepY = wmHeight + (wm.gap || 20) * (finalHeight / 100);
                  
                  ctx.translate(finalWidth / 2, finalHeight / 2);
                  if (wm.rotation) ctx.rotate((wm.rotation * Math.PI) / 180);
                  
                  const diag = Math.sqrt(finalWidth * finalWidth + finalHeight * finalHeight);
                  const countX = Math.ceil(diag / stepX);
                  const countY = Math.ceil(diag / stepY);
                  
                  for (let i = -countX; i <= countX; i++) {
                    for (let j = -countY; j <= countY; j++) {
                      ctx.drawImage(wmImg, i * stepX - wmWidth/2, j * stepY - wmHeight/2, wmWidth, wmHeight);
                    }
                  }
                } else {
                  let wx = 0, wy = 0;
                  switch (wm.position) {
                    case 'br': case 'cr': case 'tr': wx = finalWidth - wmWidth - margin; break;
                    case 'bl': case 'cl': case 'tl': wx = margin; break;
                    case 'bc': case 'cc': case 'tc': wx = (finalWidth - wmWidth) / 2; break;
                  }
                  switch (wm.position) {
                    case 'br': case 'bc': case 'bl': wy = finalHeight - wmHeight - margin; break;
                    case 'tr': case 'tc': case 'tl': wy = margin; break;
                    case 'cr': case 'cc': case 'cl': wy = (finalHeight - wmHeight) / 2; break;
                  }

                  if (wm.rotation) {
                    ctx.translate(wx + wmWidth/2, wy + wmHeight/2);
                    ctx.rotate((wm.rotation * Math.PI) / 180);
                    ctx.drawImage(wmImg, -wmWidth/2, -wmHeight/2, wmWidth, wmHeight);
                  } else {
                    ctx.drawImage(wmImg, wx, wy, wmWidth, wmHeight);
                  }
                }
                resolveWM();
              };
              wmImg.onerror = () => resolveWM(); // ignore error
              wmImg.src = wm.url!;
            });
          } else if (wm.type === 'text' && wm.text) {
            ctx.fillStyle = wm.color || 'white';
            const fontSize = finalHeight * (wm.size / 100);
            ctx.font = `bold ${fontSize}px ${wm.fontFamily || 'sans-serif'}`;
            ctx.textBaseline = 'top';
            
            const metrics = ctx.measureText(wm.text);
            const wmWidth = metrics.width;
            const wmHeight = fontSize; 
            const margin = finalWidth * (wm.padding / 100);

            if (wm.position === 'tile') {
              const stepX = wmWidth + (wm.gap || 20) * (finalWidth / 100);
              const stepY = wmHeight * 2 + (wm.gap || 20) * (finalHeight / 100); // taller step for text
              
              ctx.translate(finalWidth / 2, finalHeight / 2);
              if (wm.rotation) ctx.rotate((wm.rotation * Math.PI) / 180);
              
              const diag = Math.sqrt(finalWidth * finalWidth + finalHeight * finalHeight);
              const countX = Math.ceil(diag / stepX);
              const countY = Math.ceil(diag / stepY);
              
              ctx.textBaseline = 'middle';
              ctx.textAlign = 'center';
              for (let i = -countX; i <= countX; i++) {
                for (let j = -countY; j <= countY; j++) {
                  ctx.fillText(wm.text, i * stepX, j * stepY);
                }
              }
            } else {
              let wx = 0, wy = 0;
              switch (wm.position) {
                case 'br': case 'cr': case 'tr': wx = finalWidth - wmWidth - margin; break;
                case 'bl': case 'cl': case 'tl': wx = margin; break;
                case 'bc': case 'cc': case 'tc': wx = (finalWidth - wmWidth) / 2; break;
              }
              switch (wm.position) {
                case 'br': case 'bc': case 'bl': wy = finalHeight - wmHeight - margin; break;
                case 'tr': case 'tc': case 'tl': wy = margin; break;
                case 'cr': case 'cc': case 'cl': wy = (finalHeight - wmHeight) / 2; break;
              }
              
              if (wm.rotation) {
                ctx.translate(wx + wmWidth/2, wy + wmHeight/2);
                ctx.rotate((wm.rotation * Math.PI) / 180);
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.fillText(wm.text, 0, 0);
              } else {
                ctx.fillText(wm.text, wx, wy);
              }
            }
          }
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1.0;
      resolve(canvas.toDataURL(format, quality / 100));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};

function Main({ imgbbKey }: { imgbbKey: string }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'album'>('file');
  const [urlInput, setUrlInput] = useState('');
  
  // Settings
  const [width, setWidth] = useState<number>(0);
  const [format, setFormat] = useState<string>('image/jpeg');
  const [quality, setQuality] = useState<number>(100);
  const [imageFilter, setImageFilter] = useState<string>('none');
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all'|'idle'|'success'|'error'>('all');
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [fbScanStatus, setFbScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [fbScanMessage, setFbScanMessage] = useState('');
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  
  // Watermark Settings
  const [watermarks, setWatermarks] = useState<Watermark[]>([]);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('watermarkConfig');
      if (saved) {
        setWatermarks(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load watermarks', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('watermarkConfig', JSON.stringify(watermarks));
    } catch (e) {
      console.error('Failed to save watermarks', e);
    }
  }, [watermarks]);

  const addWatermark = (type: 'image' | 'text', url?: string) => {
    const newWm: Watermark = {
      id: Math.random().toString(36).substring(7),
      type,
      url,
      text: type === 'text' ? 'Bản quyền thuộc về' : undefined,
      color: '#ffffff',
      opacity: type === 'text' ? 100 : 70,
      position: 'br',
      size: type === 'text' ? 5 : 20,
      padding: 3
    };
    setWatermarks([...watermarks, newWm]);
  };

  const updateWatermark = (id: string, updates: Partial<Watermark>) => {
    setWatermarks(prev => prev.map(wm => wm.id === id ? { ...wm, ...updates } : wm));
  };

  const removeWatermark = (id: string) => {
    setWatermarks(prev => prev.filter(wm => wm.id !== id));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
      
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      const files: File[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const file = clipboardItems[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        files.forEach(f => dataTransfer.items.add(f));
        handleAddedFiles(dataTransfer.files);
        setActiveTab('file');
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    if (previewIndex === null || !items[previewIndex]) {
      setPreviewUrl(null);
      return;
    }
    
    let isMounted = true;
    const generatePreview = async () => {
      const item = items[previewIndex];
      let objectUrl = '';
      if (item.source === 'url' && item.originalUrl) {
         try {
           const res = await fetch(item.originalUrl);
           const blob = await res.blob();
           objectUrl = URL.createObjectURL(blob);
         } catch {
           return;
         }
      } else if (item.file) {
         objectUrl = URL.createObjectURL(item.file);
      }
      
      if (objectUrl) {
         try {
           const url = await processImage(objectUrl, 800, 'image/jpeg', 80, watermarks, imageFilter);
           if (isMounted) setPreviewUrl(url);
         } catch (e) {
           console.error("Preview failed", e);
         }
         URL.revokeObjectURL(objectUrl);
      }
    };
    generatePreview();
    
    return () => { isMounted = false; };
  }, [previewIndex, items, watermarks]);

  const handleWatermarkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addWatermark('image', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddedFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: UploadItem[] = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substring(7),
        source: 'file',
        file,
        name: file.name,
        thumbUrl: URL.createObjectURL(file),
        status: 'idle'
      }));
    setItems(prev => [...prev, ...newItems]);
  };

  const handleAddUrls = () => {
    const urls = urlInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    const newItems: UploadItem[] = urls.map(url => ({
      id: Math.random().toString(36).substring(7),
      source: 'url',
      originalUrl: url,
      thumbUrl: url,
      name: new URL(url).hostname || 'Phím tắt URL',
      status: 'idle'
    }));
    setItems(prev => [...prev, ...newItems]);
    setUrlInput('');
  };

  const scanFacebookUrl = async () => {
    if (!urlInput.trim()) return;
    
    // Check if we are in chrome extension environment (heuristic)
    // @ts-ignore
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    
    if (!isExtension) {
      setShowExtensionModal(true);
      return;
    }
    
    try {
      setFbScanStatus('scanning');
      setFbScanMessage('Đang kết nối Facebook bài viết...');
      const response = await fetch(urlInput);
      if (!response.ok) throw new Error("Không thể kết nối đến máy chủ");
      setFbScanMessage('Đang đọc mã HTML cấu trúc...');
      const text = await response.text();
      
      // Regex trích xuất tất cả các link ảnh scontent
      const regex1 = /https:\\\/\\\/scontent[^\s"']+\.(?:jpg|jpeg|png|webp)[^\s"'\\]*/gi;
      const regex2 = /https:\/\/scontent[^\s"']+\.(?:jpg|jpeg|png|webp)[^\s"'\\]*/gi;
      
      const matches1 = text.match(regex1) || [];
      const matches2 = text.match(regex2) || [];
      
      let allUrls = [...matches1, ...matches2].map(u => u.replace(/\\\//g, '/').replace(/&amp;/g, '&'));
      allUrls = Array.from(new Set(allUrls));
      
      // Loại bỏ ảnh avatar, thumbnail nhỏ
      const highResUrls = allUrls.filter(u => !u.includes('p50x50') && !u.includes('p75x75') && !u.includes('p100x100') && !u.includes('cp0'));
      
      if (highResUrls.length === 0) {
        setFbScanStatus('error');
        setFbScanMessage("Không tìm thấy ảnh. Có thể bài viết bị ẩn hoặc ở chế độ riêng tư.");
        return;
      }
      
      const newItems: UploadItem[] = highResUrls.map(url => ({
        id: Math.random().toString(36).substring(7),
        source: 'url',
        originalUrl: url,
        thumbUrl: url,
        name: 'FB_IMG_' + url.split('?')[0].substr(-15),
        status: 'idle'
      }));
      setItems(prev => [...prev, ...newItems]);
      setUrlInput('');
      setFbScanStatus('success');
      setFbScanMessage(`Đã quét thành công ${newItems.length} ảnh!`);
      
      // Delay before resetting and switching tab to show success message
      setTimeout(() => {
        setFbScanStatus('idle');
        setFbScanMessage('');
        setActiveTab('url');
      }, 2000);
      
    } catch (e: any) {
      setFbScanStatus('error');
      setFbScanMessage("Lỗi khi quét: " + e.message);
    }
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleUpload = async () => {
    if (uploading) {
      uploadingRef.current = false;
      setUploading(false);
      return;
    }
    setUploading(true);
    uploadingRef.current = true;
    
    for (let i = 0; i < items.length; i++) {
      if (!uploadingRef.current) break;
      const item = items[i];
      if (item.status === 'success' || item.status === 'uploading') continue;

      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'uploading', errorMsg: undefined } : p));
      
      try {
        const form = new FormData();
        const hasWatermarks = watermarks.length > 0;

        if (item.source === 'url') {
          if (hasWatermarks || width > 0 || format !== 'image/jpeg' || imageFilter !== 'none') {
            try {
              const res = await fetch(item.originalUrl!);
              if (!res.ok) throw new Error('Không thể tải ảnh gốc');
              const blob = await res.blob();
              const objectUrl = URL.createObjectURL(blob);
              const base64Url = await processImage(objectUrl, width, format, quality, watermarks, imageFilter);
              form.append('image', base64Url.split(',')[1]);
              URL.revokeObjectURL(objectUrl);
            } catch (err: any) {
              if (hasWatermarks || imageFilter !== 'none') {
                throw new Error('Lỗi CORS chặn xử lý ảnh. Thử cài Extension.');
              }
              form.append('image', item.originalUrl!);
            }
          } else {
            form.append('image', item.originalUrl!);
          }
        } else if (item.file) {
          const objectUrl = URL.createObjectURL(item.file);
          const base64Url = await processImage(objectUrl, width, format, quality, watermarks, imageFilter);
          form.append('image', base64Url.split(',')[1]);
          URL.revokeObjectURL(objectUrl);
        }
        
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
          method: 'POST',
          body: form
        });
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Tải lên thất bại');
        }

        setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'success', url: data.data.url, thumbUrl: data.data.thumb?.url || data.data.url } : p));
      } catch (err: any) {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error', errorMsg: err.message } : p));
      }
    }
    
    // If not paused manually and all pending are processed, check if there are no more pending
    if (uploadingRef.current) {
        setItems(prev => {
            const hasPending = prev.some(i => i.status === 'idle' || i.status === 'error');
            const hasSuccess = prev.some(i => i.status === 'success');
            if (!hasPending && hasSuccess) {
                setShowUploadSuccess(true);
                setTimeout(() => setShowUploadSuccess(false), 4000);
            }
            return prev;
        });
    }

    uploadingRef.current = false;
    setUploading(false);
  };

  const reprocessItem = (id: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, status: 'idle', url: undefined, errorMsg: undefined, thumbUrl: p.originalUrl || p.thumbUrl } : p));
  };

  const successUrls = items.filter(i => i.status === 'success' && i.url).map(i => i.url!);
  const totalFiles = items.filter(i => i.status !== 'success').length > 0 ? items.length : 0;
  const completedCount = items.filter(i => i.status === 'success' || i.status === 'error').length;
  // If uploading is true, show progress of uploading.
  const isPendingFiles = items.some(i => i.status === 'idle' || i.status === 'error');
  const progressPercent = uploading && items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  
  const copyAllToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copySingle = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-orange-200 shadow-lg">
            <div className="text-white font-bold text-xl">B</div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">BlogUploader Pro</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {imgbbKey ? (
            <div className="flex items-center gap-2 bg-slate-100 py-1.5 px-3 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-slate-600 font-medium">Đã cấu hình API</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 py-1.5 px-3 rounded-full">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-slate-600 font-medium">Thiếu API Key</span>
            </div>
          )}
          <div className="w-10 h-10 bg-slate-200 rounded-full border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500"></div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 h-[calc(100%-64px)] overflow-hidden">
        
        {/* Left Column */}
        <div className="flex-[3] flex flex-col gap-6 h-full min-h-0 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col shrink-0">
            <div className="flex gap-4 mb-6 border-b border-slate-100 overflow-x-auto custom-scrollbar shrink-0">
              <button 
                onClick={() => setActiveTab('file')}
                className={`pb-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'file' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Từ máy tính
                {activeTab === 'file' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
              </button>
              <button 
                onClick={() => setActiveTab('url')}
                className={`pb-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'url' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Nhập link tự động
                {activeTab === 'url' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
              </button>
              <button 
                onClick={() => setActiveTab('album')}
                className={`pb-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'album' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Quét FB (Post/Album)
                {activeTab === 'album' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
              </button>
            </div>

            {activeTab === 'file' && (
              <div 
                className="h-32 border-2 border-dashed border-indigo-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleAddedFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-6 h-6 text-indigo-500 mb-2" />
                <p className="text-sm font-medium text-slate-600">Click hoặc kéo thả nhiều ảnh vào đây</p>
                <input 
                  type="file" multiple ref={fileInputRef} className="hidden"
                  onChange={e => handleAddedFiles(e.target.files)} accept="image/*"
                />
              </div>
            )}
            
            {activeTab === 'url' && (
              <div className="flex flex-col gap-3">
                <textarea 
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Dán các link ảnh trực tiếp vào đây... (mỗi link một dòng)"
                  className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
                <button 
                  onClick={handleAddUrls} disabled={!urlInput.trim()}
                  className="self-end px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >Thêm vào danh sách</button>
              </div>
            )}

            {activeTab === 'album' && (
              <div className="flex flex-col gap-3">
                <input 
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Dán link bài viết (Post) hoặc Album Facebook..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 leading-relaxed flex gap-2">
                  <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Mẹo Extension:</strong> Để trích xuất toàn bộ ảnh từ bài viết (Post) hoặc Album mà không bị Facebook chặn (CORS), tính năng này được thiết kế như một <strong>Chrome Extension</strong>. Vui lòng làm theo hướng dẫn cài đặt.
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm font-medium">
                    {fbScanStatus === 'scanning' && <span className="text-blue-600 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> {fbScanMessage}</span>}
                    {fbScanStatus === 'success' && <span className="text-green-600 flex items-center gap-2"><Check className="w-4 h-4" /> {fbScanMessage}</span>}
                    {fbScanStatus === 'error' && <span className="text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {fbScanMessage}</span>}
                  </div>
                  <button 
                    onClick={scanFacebookUrl} 
                    disabled={!urlInput.trim() || fbScanStatus === 'scanning'}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {fbScanStatus === 'scanning' ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                    {fbScanStatus === 'scanning' ? 'Đang quét...' : 'Tiến hành quét dữ liệu'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center mb-4 flex-shrink-0 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Danh sách ({items.length})</h3>
              {items.length > 0 && (
                <div className="flex gap-2 items-center">
                  <select value={filter} onChange={e => setFilter(e.target.value as any)} className="text-[10px] bg-slate-100 border-none rounded p-1 text-slate-600 font-bold uppercase outline-none cursor-pointer">
                    <option value="all">Tất cả</option>
                    <option value="idle">Chưa chạy</option>
                    <option value="success">Thành công</option>
                    <option value="error">Lỗi</option>
                  </select>
                  <button onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} className="p-1 rounded text-slate-400 hover:bg-slate-100">
                    {viewMode === 'list' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button onClick={() => setItems(prev => prev.filter(i => i.status !== 'error'))} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase transition">Xóa lỗi</button>
                  <button onClick={() => setItems([])} className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase transition">Xóa hết</button>
                </div>
              )}
            </div>
            <div className={`flex-1 overflow-y-auto custom-scrollbar pr-2 ${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start' : 'space-y-2'}`}>
              {items.length === 0 ? (
                <div className="col-span-full h-full flex items-center justify-center text-sm text-slate-400">Chưa có ảnh nào được thêm. Bạn có thể bấm <kbd className="mx-1 bg-slate-100 px-1 rounded shadow-sm border border-slate-200">Ctrl/Cmd + V</kbd> để dán.</div>
              ) : items.filter(i => filter === 'all' || i.status === filter).map((item) => (
                <div key={item.id} className={`group relative flex ${viewMode === 'list' ? 'items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl' : 'flex-col bg-slate-50 border border-slate-200 shadow-sm rounded-xl overflow-hidden aspect-square'}`}>
                  {viewMode === 'grid' ? (
                    <div className="absolute inset-x-0 top-0 p-1.5 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                      {item.source === 'file' ? <FileImage className="w-3.5 h-3.5 text-white" /> : <Globe className="w-3.5 h-3.5 text-white/90" />}
                      <div className="flex gap-1 bg-white/20 rounded-full px-1 py-0.5 backdrop-blur-sm">
                        {item.status === 'success' && <Check className="w-3 h-3 text-green-300" />}
                        {item.status === 'uploading' && <RefreshCw className="w-3 h-3 text-white animate-spin" />}
                        {item.status === 'error' && <AlertCircle className="w-3 h-3 text-red-300" />}
                        {item.status === 'idle' && <div className="w-1.5 h-1.5 rounded-full bg-white/80 m-0.5"></div>}
                      </div>
                    </div>
                  ) : (
                    item.source === 'file' ? <FileImage className="w-5 h-5 text-indigo-400 shrink-0" /> : <Globe className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}

                  {viewMode === 'list' && item.thumbUrl && (
                    <div className="w-10 h-10 shrink-0 bg-slate-200 rounded overflow-hidden relative group/img">
                      <img src={item.status === 'success' && item.url ? item.url : item.thumbUrl} className="w-full h-full object-cover absolute inset-0" />
                      {item.status === 'success' && item.url && (
                        <img src={item.thumbUrl} className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" title="Ảnh gốc" />
                      )}
                    </div>
                  )}

                  {viewMode === 'grid' && (
                     <div className="absolute inset-0 bg-slate-200 flex items-center justify-center overflow-hidden">
                       {item.thumbUrl ? (
                         <>
                           <img 
                             src={item.status === 'success' && item.url ? item.url : item.thumbUrl} 
                             className="w-full h-full object-cover absolute inset-0 z-0" 
                           />
                           {item.status === 'success' && item.url && (
                             <img 
                               src={item.thumbUrl}
                               className="w-full h-full object-cover absolute inset-0 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300 cursor-crosshair"
                               title="Xem ảnh gốc"
                             />
                           )}
                         </>
                       ) : <span className="text-xs text-slate-400 font-mono">IMG</span>}
                     </div>
                  )}

                  {viewMode === 'list' ? (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                      {item.source === 'url' && <p className="text-xs text-slate-400 truncate">{item.originalUrl}</p>}
                      {item.errorMsg && <p className="text-xs text-red-500 mt-1">{item.errorMsg}</p>}
                    </div>
                  ) : (
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent z-10 duration-200 group-hover:opacity-0 pointer-events-none text-center">
                      <p className="text-[10px] font-medium text-white truncate drop-shadow">{item.name}</p>
                      {item.errorMsg && <p className="text-[9px] text-red-300 truncate mt-0.5" title={item.errorMsg}>{item.errorMsg}</p>}
                    </div>
                  )}

                  <div className={`flex items-center gap-1.5 shrink-0 ${viewMode === 'grid' ? 'absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity justify-center z-20 pointer-events-none [&>*]:pointer-events-auto' : ''}`}>
                    {item.status === 'success' && viewMode === 'list' && <Check className="w-4 h-4 text-green-600" />}
                    {item.status === 'uploading' && viewMode === 'list' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                    {item.status === 'error' && viewMode === 'list' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    
                    {(item.status === 'success' || item.status === 'error' || item.status === 'idle') && (
                       <button onClick={() => setPreviewIndex(items.findIndex(i => i.id === item.id))} className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white hover:bg-slate-100 text-slate-700 shadow-lg' : 'hover:bg-slate-200 text-slate-500'}`} title="Xem trước kết quả">
                         <Eye className="w-4 h-4" />
                       </button>
                    )}

                    {(item.status === 'success' || item.status === 'error' || item.status === 'idle') && (
                       <button onClick={() => reprocessItem(item.id)} className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white hover:bg-indigo-50 text-indigo-600 shadow-lg' : 'hover:bg-slate-200 text-slate-500'}`} title="Tải lại (Reset)">
                         <RefreshCw className="w-4 h-4" />
                       </button>
                    )}
                    
                    {item.status !== 'uploading' && (
                      <button onClick={() => removeItem(item.id)} className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white hover:bg-red-50 text-red-600 shadow-lg' : 'hover:bg-red-100 text-slate-400 hover:text-red-600'}`} title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex-[2] flex flex-col gap-6 h-full min-h-0 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 shrink-0">
            <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-500" />
              Tùy chỉnh hình ảnh
            </h2>
            
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">ĐỊNH DẠNG</span>
                <div className="flex flex-1 gap-2">
                  {['image/webp', 'image/jpeg', 'image/png'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${format === fmt ? 'border-2 border-indigo-100 text-indigo-700 bg-indigo-50/50' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {fmt.split('/')[1].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {(format === 'image/jpeg' || format === 'image/webp') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">CHẤT LƯỢNG: {quality}%</span>
                  <input type="range" min="1" max="100" value={quality} onChange={e => setQuality(parseInt(e.target.value))} className="flex-1 accent-indigo-600" />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">BỘ LỌC MÀU</span>
                <select 
                  value={imageFilter} 
                  onChange={e => setImageFilter(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500/20"
                >
                  <optgroup label="Cơ bản">
                    <option value="none">Bình thường</option>
                    <option value="grayscale(100%)">Trắng đen (Grayscale)</option>
                    <option value="sepia(100%)">Hoài cổ (Sepia)</option>
                    <option value="invert(100%)">Đảo ngược (Invert)</option>
                    <option value="blur(3px)">Mờ (Blur)</option>
                    <option value="brightness(150%)">Sáng hơn (Brightness)</option>
                    <option value="brightness(60%)">Tối hơn (Darkness)</option>
                    <option value="contrast(150%)">Tương phản cao (Contrast)</option>
                    <option value="saturate(200%)">Rực rỡ (Saturate)</option>
                    <option value="hue-rotate(90deg)">Đổi màu (Hue 90°)</option>
                    <option value="hue-rotate(180deg)">Đổi màu (Hue 180°)</option>
                  </optgroup>
                  <optgroup label="Điện ảnh & Nghệ thuật (Instagram style)">
                    <option value="contrast(120%) saturate(125%)">📸 Clarendon</option>
                    <option value="brightness(105%) hue-rotate(350deg)">📸 Gingham</option>
                    <option value="sepia(30%) saturate(140%) contrast(110%) hue-rotate(-10deg)">📸 Juno</option>
                    <option value="sepia(30%) contrast(110%) brightness(110%) saturate(130%) hue-rotate(10deg)">📸 Lark</option>
                    <option value="contrast(150%) saturate(110%) sepia(20%)">🎞️ Reyes</option>
                    <option value="sepia(40%) contrast(150%) saturate(130%) hue-rotate(-20deg)">🎬 Điện ảnh (Cinematic)</option>
                    <option value="saturate(150%) contrast(110%) brightness(110%)">🌟 Rực rỡ & Nét (Vibrant)</option>
                    <option value="brightness(110%) contrast(90%) saturate(110%) sepia(10%)">👤 Chân dung (Portrait)</option>
                    <option value="sepia(50%) contrast(120%) brightness(90%) saturate(80%) hue-rotate(-20deg)">📻 Vintage (Hoài niệm)</option>
                    <option value="saturate(300%) contrast(150%) hue-rotate(45deg)">💡 Neon (Cyberpunk)</option>
                    <option value="grayscale(100%) contrast(200%) brightness(120%)">✏️ Tranh vẽ (Sketch)</option>
                    <option value="contrast(140%) saturate(140%) brightness(110%)">🎨 Siêu nét (HDR)</option>
                  </optgroup>
                </select>
              </div>

              {/* WATERMARK */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-500 block mb-3">ĐÓNG DẤU LOGO (WATERMARK)</label>
                <input type="file" ref={watermarkInputRef} onChange={handleWatermarkFile} className="hidden" accept="image/png, image/webp" />
                
                <div className="space-y-3 mb-3">
                  {watermarks.map((wm) => (
                    <div key={wm.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg relative group">
                      <button onClick={() => removeWatermark(wm.id)} className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition shadow-sm z-10"><Trash2 className="w-3.5 h-3.5" /></button>
                      
                      <div className="flex gap-4">
                        {/* Position Matrix Picker */}
                        <div className="shrink-0 flex flex-col items-center gap-1.5 mt-1">
                          <div className="text-[9px] font-bold text-slate-400 tracking-wider">VỊ TRÍ</div>
                          <div className="grid grid-cols-3 gap-[2px] bg-slate-300 p-[2px] rounded-md shadow-inner">
                              {(['tl','tc','tr','cl','cc','cr','bl','bc','br'] as Position[]).map(pos => (
                                <button 
                                  key={pos} 
                                  onClick={() => updateWatermark(wm.id, { position: pos })} 
                                  className={`w-5 h-5 flex items-center justify-center rounded-[3px] transition ${wm.position === pos ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white hover:bg-slate-100'}`}
                                />
                              ))}
                          </div>
                          <button
                            onClick={() => updateWatermark(wm.id, { position: 'tile' })}
                            className={`w-full py-1 text-[10px] font-bold rounded shadow-sm border ${wm.position === 'tile' ? 'bg-indigo-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            title="Lặp / Phủ kín"
                          >
                            PHỦ KÍN
                          </button>
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0 pr-6">
                          {wm.type === 'image' ? (
                            <div className="flex items-center gap-3 mb-3 bg-white p-1.5 rounded-lg border border-slate-200">
                              <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                <img src={wm.url} className="max-w-full max-h-full object-contain" alt="Watermark" />
                              </div>
                              <span className="text-xs text-slate-600 font-medium truncate">Ảnh Logo (Image)</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <input type="text" value={wm.text || ''} onChange={e => updateWatermark(wm.id, { text: e.target.value })} className="flex-1 text-sm font-medium border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Nhập chữ..." />
                                <div className="relative w-8 h-8 rounded-md overflow-hidden border border-slate-200 shrink-0">
                                  <input type="color" value={wm.color || '#ffffff'} onChange={e => updateWatermark(wm.id, { color: e.target.value })} className="absolute -inset-2 w-12 h-12 cursor-pointer border-0 p-0" />
                                </div>
                              </div>
                              <select 
                                value={wm.fontFamily || 'sans-serif'} 
                                onChange={e => updateWatermark(wm.id, { fontFamily: e.target.value })}
                                className="w-full text-xs font-medium border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                style={{ fontFamily: wm.fontFamily || 'sans-serif' }}
                              >
                                {FONT_FAMILIES.map(f => (
                                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2" title="Độ hiển thị (Opacity)">
                              <span className="text-[10px] text-slate-500 font-medium w-10">Mờ:</span>
                              <input type="range" min="10" max="100" value={wm.opacity} onChange={e => updateWatermark(wm.id, { opacity: parseInt(e.target.value) })} className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                            </div>
                            <div className="flex items-center gap-2" title="Kích thước">
                              <span className="text-[10px] text-slate-500 font-medium w-10">Cỡ:</span>
                              <input type="range" min="1" max="100" value={wm.size} onChange={e => updateWatermark(wm.id, { size: parseInt(e.target.value) })} className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                            </div>
                            <div className="flex items-center gap-2" title="Độ nghiêng (Rotation)">
                              <span className="text-[10px] text-slate-500 font-medium w-10">Nghiêng:</span>
                              <input type="range" min="-180" max="180" value={wm.rotation || 0} onChange={e => updateWatermark(wm.id, { rotation: parseInt(e.target.value) })} className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                            </div>
                            {wm.position === 'tile' ? (
                              <div className="flex items-center gap-2" title="Khoảng cách lặp (Gap)">
                                <span className="text-[10px] text-slate-500 font-medium w-10">Lặp:</span>
                                <input type="range" min="0" max="100" value={wm.gap || 20} onChange={e => updateWatermark(wm.id, { gap: parseInt(e.target.value) })} className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2" title="Khoảng cách lề">
                                <span className="text-[10px] text-slate-500 font-medium w-10">Lề:</span>
                                <input type="range" min="0" max="50" value={wm.padding} onChange={e => updateWatermark(wm.id, { padding: parseInt(e.target.value) })} className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onMouseDown={createRipple} onClick={() => watermarkInputRef.current?.click()} className="relative overflow-hidden flex-1 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-indigo-600 flex justify-center items-center gap-2 transition">
                    <ImagePlus className="w-4 h-4" /> THÊM LOGO
                  </button>
                  <button onMouseDown={createRipple} onClick={() => addWatermark('text')} className="relative overflow-hidden flex-1 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-indigo-600 flex justify-center items-center gap-2 transition">
                    <Type className="w-4 h-4" /> THÊM TEXT
                  </button>
                </div>
              </div>

              <button 
                onClick={toggleUpload}
                onMouseDown={createRipple}
                disabled={!uploading && !isPendingFiles}
                className={`w-full relative overflow-hidden mt-2 py-3.5 text-white font-bold rounded-xl transition-all ${!uploading && !isPendingFiles ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : (!imgbbKey ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200' : (uploading ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 active:scale-[0.98]' : 'bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200 active:scale-[0.98]'))}`}
              >
                {uploading && (
                  <div className="absolute inset-y-0 left-0 bg-green-500/20 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <Pause className="w-5 h-5" />
                      TẠM DỪNG ({items.filter(i => i.status === 'success').length}/{items.length})
                    </>
                  ) : progressPercent > 0 && isPendingFiles ? (
                    <>
                      <Play className="w-5 h-5" />
                      TIẾP TỤC TẢI ({items.filter(i => i.status === 'success').length}/{items.length})
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      BẮT ĐẦU TẢI LÊN MÁY CHỦ
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col shrink-0 min-h-[250px] lg:h-full lg:overflow-hidden">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Kết quả ({successUrls.length})
              </h2>
              {successUrls.length > 0 && <button onClick={() => copyAllToClipboard(successUrls.join('\n'))} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase transition-colors">{copiedAll ? 'Đã sao chép' : 'Sao chép tất cả'}</button>}
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
              {items.filter(i => i.status === 'success').length === 0 ? (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-500">Các link ảnh thành công sẽ hiện ở đây...</div>
              ) : items.filter(i => i.status === 'success').map(item => (
                <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-slate-600">
                    <img src={item.thumbUrl || item.url} alt="thumb" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 truncate mb-1">{item.name}</p>
                    <p className="text-[11px] font-mono text-slate-300 truncate select-all">{item.url}</p>
                  </div>
                  <button 
                    onClick={() => copySingle(item.url!, item.id)}
                    className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition shrink-0"
                    title="Sao chép Link"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </main>

      {/* Extension Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Cần cài đặt Chrome Extension</h3>
                </div>
                <button onClick={() => setShowExtensionModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Do Facebook chặn truy cập ảnh từ bên ngoài (lỗi CORS), bạn <strong>không thể</strong> quét ảnh trực tiếp trên trình duyệt web thông thường.<br/><br/>
                Để tính năng này hoạt động, bạn hãy cài đặt web app này như một công cụ <strong>Chrome Extension (tiện ích mở rộng)</strong>.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 space-y-3">
                <p className="font-semibold text-indigo-700">📌 Hướng dẫn 5 bước siêu dễ:</p>
                <ol className="list-decimal list-inside space-y-2 ml-1">
                  <li>Bấm <strong className="text-slate-900">Export/Download</strong> ở góc trên AI Studio để tải file ZIP về máy.</li>
                  <li>Giải nén thư mục, mở Terminal chạy lệnh <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-600 font-mono">npm install</code>, rồi chạy <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-600 font-mono">npm run build</code>.</li>
                  <li>Mở Chrome, truy cập vào đường dẫn <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">chrome://extensions</code></li>
                  <li>Bật <strong className="text-slate-900">Developer mode</strong> (chế độ dành cho nhà phát triển - góc phải trên).</li>
                  <li>Chọn <strong className="text-slate-900">Load unpacked</strong> (Tải tiện ích đã giải nén) và chọn thư mục <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-600 font-mono">dist</code> trong dự án bạn đã giải nén.</li>
                </ol>
                <p className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 italic">
                  💡 Sau đó, click vào biểu tượng Extension ở thanh công cụ Chrome để mở lại App và quét Facebook bình thường!
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowExtensionModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold transition"
              >
                Đã hiểu, đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Success Animation Overlay */}
      {showUploadSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-green-500/10 backdrop-blur-[2px] animate-in fade-in duration-300" />
          <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-50 spin-in-12 duration-500 z-10 border border-green-100">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 text-center">Hoàn thành tải lên!</h2>
            <p className="text-slate-500 font-medium">Tất cả ảnh đã được xử lý và tải lên thành công.</p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewIndex !== null && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="absolute top-4 right-4 flex gap-4">
            <button onClick={() => setPreviewIndex(null)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <button 
            onClick={() => setPreviewIndex(prev => prev! > 0 ? prev! - 1 : items.length - 1)}
            className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            {previewUrl ? (
              <div className="relative group/preview cursor-crosshair">
                <img src={previewUrl} className="max-w-full max-h-[80vh] object-contain rounded border border-white/20 shadow-2xl transition-opacity duration-300" alt="Preview" />
                <img 
                  src={items[previewIndex].thumbUrl} 
                  className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 rounded" 
                  alt="Original" 
                />
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 pointer-events-none">
                  Ảnh gốc
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-white/50"><RefreshCw className="w-5 h-5 animate-spin" /> Đang tạo ảnh xem trước...</div>
            )}
            <p className="text-white/70 mt-4 font-mono text-sm">{items[previewIndex].name} ({previewIndex + 1} / {items.length}) <span className="opacity-50 text-xs ml-2">- Rê chuột vào ảnh để xem bản gốc</span></p>
          </div>

          <button 
            onClick={() => setPreviewIndex(prev => prev! < items.length - 1 ? prev! + 1 : 0)}
            className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => {
    return import.meta.env.VITE_IMGBB_API_KEY || localStorage.getItem('BLOG_UPLOADER_API_KEY') || '';
  });
  const [localInput, setLocalInput] = useState('');

  const saveKey = () => {
    if (localInput.trim()) {
      localStorage.setItem('BLOG_UPLOADER_API_KEY', localInput.trim());
      setApiKey(localInput.trim());
    }
  };

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-blue-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Thiếu Key kết nối ImgBB</h2>
          <p className="text-gray-600">
            Để tạo link ảnh <code className="bg-gray-100 px-1 rounded">.jpg</code>, hệ thống cần API Key.
            <strong> {typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id ? 'Vì bạn đang dùng Chrome Extension' : 'Vì bạn đang chạy mã tải về'} </strong>, 
            vui lòng nhập API Key trực tiếp của bạn vào ô dưới đây:
          </p>
          
          <div className="flex flex-col gap-2 my-4">
            <input 
              type="text" 
              placeholder="Nhập API Key ImgBB..." 
              value={localInput} 
              onChange={e => setLocalInput(e.target.value)} 
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-full shadow-sm text-sm" 
            />
            <button 
              onClick={saveKey} 
              disabled={!localInput.trim()}
              className="px-4 py-3 bg-blue-600 font-semibold text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              Lưu Khóa (Save Key)
            </button>
          </div>

          <div className="mt-6 text-sm text-gray-500 bg-gray-100 p-4 rounded-xl text-left space-y-2">
            <p><strong>Cách lấy khóa (Free 100%):</strong></p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Truy cập <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">api.imgbb.com</a></li>
              <li>Click <strong>"Get API Key"</strong></li>
              <li>Đăng ký/Đăng nhập (bằng tài khoản Google, FB...)</li>
              <li>Tạo chìa khóa và sao chép mã (dòng dài)</li>
              <li>Dán khóa vào ô nhập bên trên.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return <Main imgbbKey={apiKey} />;
}
