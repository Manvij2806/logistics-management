import { Component, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../environments/environment';

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatMessage {
  sender: 'user' | 'ai';
  message: string;
  time: string;
  type?: 'text' | 'table' | 'agent';
}

@Component({
  selector: 'app-logistics-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logistics-ai.html',
  styleUrl: './logistics-ai.css'
})
export class LogisticsAi {

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private authService = inject(AuthService);
  private http = inject(HttpClient);

  question = '';

  attachedFile = signal<{ name: string; size: string; dataUrl: string; fileType: string } | null>(null);

  private recognition: any = null;

  isListening = signal(false);

  private readonly STORAGE_KEY = 'dispatcher_suggested_queries';
  private readonly CHAT_KEY = 'dispatcher_ai_chat_messages';

  suggestedQueries = signal<{ text: string; count: number }[]>([]);

  messages = signal<ChatMessage[]>(this.loadChatMessages());

  private loadChatMessages(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(this.CHAT_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  private saveChatMessages(msgs: ChatMessage[]): void {
    localStorage.setItem(this.CHAT_KEY, JSON.stringify(msgs));
  }


  constructor() {
    this.loadSuggestedQueries();
  }


  /* =========================================================
     USER INFORMATION
     ========================================================= */

  get dispatcherFirstName(): string {
    const name =
      this.authService.currentUser()?.full_name || 'Dispatcher';

    return name.split(' ')[0];
  }


  get dispatcherFullName(): string {
    return (
      this.authService.currentUser()?.full_name ||
      'Rakesh Sharma'
    );
  }


  get dispatcherRole(): string {
    return (
      this.authService.currentUser()?.role ||
      'Dispatcher'
    );
  }


  /* =========================================================
     SUGGESTED QUESTIONS
     ========================================================= */

  private loadSuggestedQueries(): void {

    const stored =
      localStorage.getItem(this.STORAGE_KEY);

    if (stored) {

      try {

        this.suggestedQueries.set(
          JSON.parse(stored)
        );

        return;

      } catch (error) {
        // Use defaults
      }

    }

    this.suggestedQueries.set([
      {
        text: "Show today's delayed deliveries",
        count: 0
      },
      {
        text: "Show pending orders",
        count: 0
      },
      {
        text: "Top performing agents today",
        count: 0
      },
      {
        text: "Today's revenue summary",
        count: 0
      },
      {
        text: "Cancellation report",
        count: 0
      },
      {
        text: "Vehicle utilization report",
        count: 0
      },
      {
        text: "Deliveries by area",
        count: 0
      },
      {
        text: "Agent workload summary",
        count: 0
      }
    ]);
  }


  private saveSuggestedQueries(
    queries: { text: string; count: number }[]
  ): void {

    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(queries)
    );
  }


  sortedSuggestedQueries = computed(() => {

    return [...this.suggestedQueries()]
      .sort((a, b) => b.count - a.count);

  });


  trackQuery(text: string): void {

    const queryText = text.trim();

    if (!queryText) {
      return;
    }

    this.suggestedQueries.update(currentList => {

      const match = currentList.find(
        q =>
          q.text.toLowerCase() ===
          queryText.toLowerCase()
      );

      if (match) {

        match.count += 1;

      } else {

        currentList.push({
          text: queryText,
          count: 1
        });

      }

      const updated = [...currentList];

      this.saveSuggestedQueries(updated);

      return updated;
    });
  }


  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  sendMessage(): void {

    const text = this.question.trim();
    const file = this.attachedFile();

    if (!text && !file) {
      return;
    }

    this.trackQuery(text);

    const now = new Date();

    const time = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });


    const userMsg: ChatMessage = {
      sender: 'user',
      message: text || `📎 Attached: ${file!.name}`,
      time
    };
    const withUser = [...this.messages(), userMsg];
    this.messages.set(withUser);
    this.saveChatMessages(withUser);

    this.question = '';
    this.attachedFile.set(null);

    // Add temporary loading indicator message
    const loadingMsg: ChatMessage = {
      sender: 'ai',
      message: 'Thinking...',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text'
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
          this.saveChatMessages(this.messages());
        }
      },
      error: (err) => {
        const currentMsgs = this.messages();
        if (currentMsgs.length > 0) {
          currentMsgs[currentMsgs.length - 1].message = 'Sorry, I encountered an error. Please try again.';
          this.messages.set([...currentMsgs]);
          this.saveChatMessages(this.messages());
        }
      }
    });
  }


  /* =========================================================
     QUICK QUESTION
     ========================================================= */

  askQuestion(question: string): void {

    this.question = question;

    this.sendMessage();
  }


  /* =========================================================
     CLEAR CHAT
     ========================================================= */

  clearChat(): void {
    this.messages.set([]);
    localStorage.removeItem(this.CHAT_KEY);
  }


  /* =========================================================
     VOICE
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

  goBack(): void {

    window.history.back();

  }

}