
import React, { useState, useCallback, useRef } from 'react';
import { ExtractedDocument, ChatMessage, ProcessStatus } from './types';
import { extractPdfMetadata, interrogateDocuments } from './services/gemini';
import { FileStack, MessageSquare, Loader2, Send, Trash2, Search, FileText, ChevronRight, CheckCircle2, AlertCircle, Download } from 'lucide-react';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'chat'>('upload');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setUploadProgress({ current: 0, total: files.length });
    setActiveTab('upload');

    const newDocs: ExtractedDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const doc = await extractPdfMetadata(files[i]);
        newDocs.push(doc);
        setUploadProgress(prev => ({ ...prev, current: i + 1 }));
      } catch (error) {
        console.error(`Error processing ${files[i].name}:`, error);
      }
    }

    setDocuments(prev => [...prev, ...newDocs]);
    setIsProcessing(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: query,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsChatLoading(true);

    try {
      const response = await interrogateDocuments(
        query,
        documents,
        chatMessages.map(m => ({ role: m.role, text: m.text }))
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        text: response,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsChatLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const downloadDocument = (doc: ExtractedDocument) => {
    const text = `FILENAME: ${doc.fileName}\nSENDER: ${doc.sender}\nRECIPIENT: ${doc.recipient}\nDATE: ${doc.date}\nSUMMARY: ${doc.summary}\n\nCONTENT:\n${doc.content}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace('.pdf', '')}_extracted.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllDocuments = () => {
    if (documents.length === 0) return;
    
    const combinedText = documents.map(doc => 
      `==================================================\n` +
      `FILE: ${doc.fileName}\n` +
      `SENDER: ${doc.sender}\n` +
      `RECIPIENT: ${doc.recipient}\n` +
      `DATE: ${doc.date}\n` +
      `SUMMARY: ${doc.summary}\n` +
      `--------------------------------------------------\n` +
      `CONTENT:\n${doc.content}\n` +
      `==================================================\n\n`
    ).join('\n');
    
    const blob = new Blob([combinedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documind_export_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDocs = documents.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <FileStack size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-indigo-900">DocuMind</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Bulk PDF Extraction & Intelligence</p>
          </div>
        </div>
        
        <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'upload' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'chat' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            Interrogate
            {documents.length > 0 && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Sidebar - Documents List (Hidden on mobile Chat tab) */}
        <div className={`w-full md:w-80 lg:w-96 border-r bg-white overflow-y-auto ${activeTab === 'chat' ? 'hidden md:block' : 'block'}`}>
          <div className="p-4 border-b bg-gray-50/50 sticky top-0 z-10 space-y-3">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
              <Search size={18} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Search extracted documents..." 
                className="bg-transparent border-none outline-none text-sm w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {documents.length > 0 && (
              <button 
                onClick={downloadAllDocuments}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
              >
                <Download size={14} /> Export All (.txt)
              </button>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Your Documents ({documents.length})</h2>
            </div>
            
            {documents.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="inline-block p-4 rounded-full bg-indigo-50 text-indigo-400 mb-4">
                  <FileText size={32} />
                </div>
                <p className="text-gray-500 text-sm">No documents processed yet.</p>
                <p className="text-xs text-gray-400 mt-1">Upload PDFs to start extraction.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map((doc) => (
                  <div key={doc.id} className="group p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer relative">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                          <FileText size={16} />
                        </div>
                        <h3 className="text-sm font-semibold truncate max-w-[140px]">{doc.fileName}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadDocument(doc); }}
                          className="text-gray-300 hover:text-indigo-600 transition-colors p-1"
                          title="Download Text"
                        >
                          <Download size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="font-semibold text-gray-700">From:</span> {doc.sender}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="font-semibold text-gray-700">Date:</span> {doc.date || 'Unknown'}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {doc.topics?.slice(0, 2).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">#{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Panel - Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 relative">
          
          {activeTab === 'upload' ? (
            <div className="max-w-4xl mx-auto p-6 lg:p-12 h-full flex flex-col">
              
              {/* Upload Section */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 mb-8 text-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
                  <FileStack size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload PDFs for Extraction</h2>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                  Bulk upload documents. Gemini will extract text, identify senders, dates, and topics automatically.
                </p>
                
                <label className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl cursor-pointer transition-all hover:shadow-lg active:scale-95">
                  <FileStack size={20} />
                  Choose PDF Documents
                  <input 
                    type="file" 
                    multiple 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                </label>

                {isProcessing && (
                  <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="animate-spin text-indigo-600" size={24} />
                        <span className="font-bold text-indigo-900">Processing Documents...</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-600">{uploadProgress.current} / {uploadProgress.total}</span>
                    </div>
                    <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-indigo-400 mt-4 italic">
                      Gemini is currently reading your PDFs and structuring the data...
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Insights / Featured Extracted Content */}
              {documents.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Latest Extractions</h3>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={downloadAllDocuments}
                        className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <Download size={14} /> Download All
                      </button>
                      <button onClick={() => setActiveTab('chat')} className="text-indigo-600 text-sm font-bold hover:underline flex items-center gap-1">
                        Start Querying <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {documents.slice(-4).reverse().map(doc => (
                      <div key={doc.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-indigo-200 transition-all group relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-green-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Successfully Processed</span>
                          </div>
                          <button 
                            onClick={() => downloadDocument(doc)}
                            className="opacity-0 group-hover:opacity-100 text-indigo-600 transition-all"
                            title="Download .txt"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                        <h4 className="font-bold text-gray-900 line-clamp-1 mb-1">{doc.fileName}</h4>
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                          {doc.summary}
                        </p>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Sender</span>
                            <span className="text-xs font-bold text-indigo-600">{doc.sender}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Confidence</span>
                            <div className="text-xs font-bold text-gray-700">{Math.round((doc.confidence || 0.98) * 100)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chat / Interrogate Tab */
            <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="p-6 bg-indigo-100 text-indigo-600 rounded-3xl mb-6">
                      <MessageSquare size={48} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Interrogate Your Data</h2>
                    <p className="text-gray-500 max-w-md mb-8">
                      Ask complex questions across your entire document library. 
                      Try: <span className="text-indigo-600 font-medium">"What did Jane say in her letter about the project?"</span> or <span className="text-indigo-600 font-medium">"Summarize all communications from 2023."</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                      <button 
                        onClick={() => setQuery("Who are the primary senders in these documents?")}
                        className="p-4 bg-white border border-gray-200 rounded-2xl text-left text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                      >
                        <span className="block text-indigo-600 font-bold mb-1">Senders Analysis</span>
                        <p className="text-gray-500 text-xs">Analyze everyone involved in these communications.</p>
                      </button>
                      <button 
                         onClick={() => setQuery("Provide a combined timeline of all documents.")}
                         className="p-4 bg-white border border-gray-200 rounded-2xl text-left text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                      >
                        <span className="block text-indigo-600 font-bold mb-1">Timeline Review</span>
                        <p className="text-gray-500 text-xs">Organize documents chronologically.</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-4 ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                            {msg.role === 'user' ? 'You' : 'DocuMind Assistant'}
                          </span>
                          <span className={`text-[10px] ${msg.role === 'user' ? 'text-indigo-300' : 'text-gray-300'}`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 rounded-bl-none shadow-sm flex items-center gap-3">
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                      <span className="text-sm font-medium text-gray-500">Processing context and thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 md:p-6 bg-white border-t">
                {documents.length === 0 && (
                  <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm">
                    <AlertCircle size={16} />
                    <span>Upload documents first to start interrogating the data.</span>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={documents.length > 0 ? "Ask anything about your documents..." : "Upload documents to begin..."}
                    disabled={documents.length === 0 || isChatLoading}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 pr-16 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || isChatLoading || documents.length === 0}
                    className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:bg-gray-400"
                  >
                    <Send size={20} />
                  </button>
                </form>
                <p className="text-center text-[10px] text-gray-400 mt-4 uppercase font-bold tracking-widest">
                  Powered by Gemini 3 Flash Intelligence
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Persistence Note */}
      <footer className="bg-white border-t px-6 py-2 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        <span>&copy; 2024 DocuMind Intelligence</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> API Connection Active
          </span>
          <span>Version 1.2.1</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
