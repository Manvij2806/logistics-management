import { Component, signal, Output, EventEmitter, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface ChatMessage {
  sender: 'user' | 'ai';
  message: string;
  time: string;
  type?: 'text' | 'table' | 'delivery';
  attachment?: { name: string; size: string; dataUrl: string; fileType: string };
}

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

@Component({
  selector: 'app-logistics-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logistics-ai.html',
  styleUrl: './logistics-ai.scss'
})
export class LogisticsAi {
  @Output() viewChange = new EventEmitter<string>();

  private http = inject(HttpClient);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly CHAT_KEY = 'customer_ai_chat_messages';

  question = '';

  isListening = signal(false);

  attachedFile = signal<{ name: string; size: string; dataUrl: string; fileType: string } | null>(null);

  private recognition: any = null;

  messages = signal<ChatMessage[]>(this.loadMessages());

  private loadMessages(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(this.CHAT_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  private saveMessages(msgs: ChatMessage[]): void {
    localStorage.setItem(this.CHAT_KEY, JSON.stringify(msgs));
  }

  suggestedQuestions = [
    'Where is my order #DLV12345?',
    'Show my active deliveries',
    'How do I change my delivery address?',
    'When will my order #DLV12347 arrive?',
    'Contact customer support',
    'How to cancel a delivery?',
    'Show my delivery history',
    'How to report a damaged item?'
  ];

  systemInsights = [
    { title: 'Total Deliveries', value: '1,248', change: '12.5%', direction: 'up', icon: '▣' },
    { title: 'On-Time Delivery', value: '85.3%', change: '8.7%', direction: 'up', icon: '✓' },
    { title: 'Average Delay', value: '18 mins', change: '6.3%', direction: 'down', icon: '◷' },
    { title: 'Active Agents', value: '156', change: '4.2%', direction: 'up', icon: '♙' }
  ];


  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  sendMessage(): void {
    const text = this.question.trim();
    const file = this.attachedFile();

    if (!text && !file) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      sender: 'user',
      message: text || `📎 Attached: ${file!.name}`,
      time,
      ...(file ? { attachment: file } : {})
    };

    const withUser = [...this.messages(), userMsg];
    this.messages.set(withUser);
    this.saveMessages(withUser);
    this.question = '';
    this.attachedFile.set(null);

    // Add temporary loading indicator message
    const loadingMsg: ChatMessage = {
      sender: 'ai',
      message: 'Thinking...',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.messages.set([...withUser, loadingMsg]);

    const reqPayload = {
      question: text || `Analyzed file: ${file?.name}`
    };

    this.http.post<any>(`${environment.apiUrl}/api/ai/chat`, reqPayload).subscribe({
      next: (res) => {
        const currentMsgs = this.messages();
        if (currentMsgs.length > 0) {
          currentMsgs[currentMsgs.length - 1].message = res.response;
          this.messages.set([...currentMsgs]);
          this.saveMessages(this.messages());
        }
      },
      error: (err) => {
        const currentMsgs = this.messages();
        if (currentMsgs.length > 0) {
          currentMsgs[currentMsgs.length - 1].message = 'Sorry, I encountered an error. Please try again.';
          this.messages.set([...currentMsgs]);
          this.saveMessages(this.messages());
        }
      }
    });
  }

  askQuestion(question: string): void {
    this.question = question;
    this.sendMessage();
  }

  clearChat(): void {
    this.messages.set([]);
    localStorage.removeItem(this.CHAT_KEY);
  }


  /* =========================================================
     VOICE — Web Speech API
     ========================================================= */

  toggleVoice(): void {
    if (this.isListening()) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  private startListening(): void {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice input is not supported in your browser. Please use Chrome.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-IN';
    this.recognition.interimResults = true;
    this.recognition.continuous = false;

    this.recognition.onstart = () => { this.isListening.set(true); };

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as SpeechRecognitionResultList)
        .map((result: SpeechRecognitionResult) => result[0].transcript)
        .join('');
      this.question = transcript;
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListening.set(false);
    };

    this.recognition.onend = () => { this.isListening.set(false); };

    this.recognition.start();
  }

  private stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.isListening.set(false);
  }


  /* =========================================================
     FILE UPLOAD
     ========================================================= */

  triggerFileUpload(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.attachedFile.set({
        name: file.name,
        size: this.formatFileSize(file.size),
        dataUrl: reader.result as string,
        fileType: file.type
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeAttachment(): void {
    this.attachedFile.set(null);
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }


  /* =========================================================
     BACK
     ========================================================= */

  speakMessage(text: string | undefined): void {
    if (!text) return;
    const cleanText = text
      .replace(/[\*#`|]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-IN';
    window.speechSynthesis.speak(utterance);
  }

  formatMessage(msg: string | undefined): string {
    if (!msg) return '';
    
    let html = msg
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    // Format headers dynamically (1 to 6 hashes)
    html = html.replace(/^(#{1,6})\s*(.*$)/gim, (match, hashes, content) => {
      const level = hashes.length;
      const size = level === 1 ? '20px' : level === 2 ? '18px' : level === 3 ? '16px' : '14px';
      const weight = level <= 3 ? '700' : '600';
      return `<h${level} style="margin: 10px 0 4px 0; color: #1e293b; font-weight: ${weight}; font-size: ${size};">${content}</h${level}>`;
    });
    
    // Format status badges dynamically
    html = html.replace(/\*\*(Delivered)\*\*/g, '<span style="background-color: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">$1</span>');
    html = html.replace(/\*\*(Cancelled)\*\*/g, '<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">$1</span>');
    html = html.replace(/\*\*(In Transit)\*\*/g, '<span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">$1</span>');
    html = html.replace(/\*\*(Out for Delivery)\*\*/g, '<span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">$1</span>');
    html = html.replace(/\*\*(Assigned)\*\*/g, '<span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">$1</span>');
    html = html.replace(/\*\*(Picked Up)\*\*/g, '<span style="background-color: #f3e8ff; color: #6b21a8; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">$1</span>');
    
    // Format bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Format bullet points
    html = html.replace(/^\* (.*$)/gim, '<li style="margin-left: 16px; margin-bottom: 4px;">$1</li>');
    
    // Format italics
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Format inline code
    html = html.replace(/`(.*?)`/g, '<code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #ef4444;">$1</code>');
    
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let output = [];
    
    for (let line of lines) {
      if (line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<div style="overflow-x: auto; margin: 10px 0; border: 1px solid #e2e8f0; border-radius: 8px;"><table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">';
        }
        
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        if (line.includes('---')) {
          continue;
        }
        
        const isHeader = !line.includes('**') && (output.length === 0 || !lines[lines.indexOf(line)-1].trim().startsWith('|') || lines[lines.indexOf(line)-1].includes('---'));
        const rowTag = inTable && tableHtml.endsWith('">') ? 'th' : 'td';
        
        tableHtml += '<tr style="border-bottom: 1px solid #e2e8f0;">';
        for (let cell of cells) {
          const tag = rowTag === 'th' ? 'th' : 'td';
          const style = tag === 'th' 
            ? 'padding: 8px 12px; background-color: #f8fafc; font-weight: 600; color: #475569;' 
            : 'padding: 8px 12px; color: #334155;';
          tableHtml += `<${tag} style="${style}">${cell}</${tag}>`;
        }
        tableHtml += '</tr>';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table></div>';
          output.push(tableHtml);
          tableHtml = '';
        }
        output.push(line);
      }
    }
    
    if (inTable) {
      tableHtml += '</table></div>';
      output.push(tableHtml);
    }
    
    return output.join('<br>');
  }

  goBack(): void {
    this.viewChange.emit('dashboard');
  }
}
