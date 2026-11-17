import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type PaymentPercentage = 0 | 50 | 100;

interface Booking {
  date: string;
  name: string;
  phone: string;
  value: number;
  payment: PaymentPercentage;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class App {
  private readonly storageKey = 'locacoes_churrasqueira_v1';
  private readonly today = new Date();

  bookings = this.loadBookings();
  year = this.today.getFullYear();
  month = this.today.getMonth();
  editingDate: string | null = null;
  formDate = this.formatDate(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
  name = '';
  phone = '';
  value = '';
  payment = '0';
  notice = '';
  noticeType: 'error' | 'success' = 'error';

  readonly weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  get calendarDays(): (number | null)[] {
    const firstWeekday = new Date(this.year, this.month, 1).getDay();
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    return [
      ...Array<number | null>(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }

  get monthLabel(): string {
    return new Date(this.year, this.month, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }

  get monthlyBookings(): Booking[] {
    const prefix = `${this.year}-${this.pad(this.month + 1)}-`;
    return this.bookings
      .filter((booking) => booking.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  get receivedTotal(): number {
    return this.monthlyBookings.reduce(
      (total, booking) => total + (booking.value * booking.payment) / 100,
      0,
    );
  }

  get pendingTotal(): number {
    return this.monthlyBookings.reduce(
      (total, booking) => total + (booking.value * (100 - booking.payment)) / 100,
      0,
    );
  }

  get paymentReceived(): number {
    return (Number(this.value) * Number(this.payment)) / 100 || 0;
  }

  get paymentPending(): number {
    return (Number(this.value) * (100 - Number(this.payment))) / 100 || 0;
  }

  formatMoney(amount: number): string {
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDisplayDate(date: string): string {
    return date.split('-').reverse().join('/');
  }

  bookingForDay(day: number): Booking | undefined {
    return this.bookings.find(
      (booking) => booking.date === this.dayDate(day),
    );
  }

  dayDate(day: number): string {
    return this.formatDate(this.year, this.month, day);
  }

  changeMonth(offset: number): void {
    const date = new Date(this.year, this.month + offset, 1);
    this.year = date.getFullYear();
    this.month = date.getMonth();
    this.resetForm();
  }

  selectDate(day: number): void {
    const date = this.formatDate(this.year, this.month, day);
    const booking = this.bookings.find((item) => item.date === date);

    this.formDate = date;
    this.editingDate = booking?.date ?? null;
    this.name = booking?.name ?? '';
    this.phone = booking?.phone ?? '';
    this.value = booking ? String(booking.value) : '';
    this.payment = String(booking?.payment ?? 0);
    this.clearNotice();
  }

  resetForm(): void {
    this.editingDate = null;
    this.formDate = this.formatDate(this.year, this.month, 1);
    this.name = '';
    this.phone = '';
    this.value = '';
    this.payment = '0';
    this.clearNotice();
  }

  clearForm(): void {
    this.resetForm();
  }

  saveBooking(event: SubmitEvent): void {
    event.preventDefault();

    const date = this.formDate;
    const name = this.name.trim();
    const value = Number(this.value);
    const payment = Number(this.payment);

    if (!date || !name || !Number.isFinite(value) || value <= 0) {
      this.showNotice('Preencha data, nome e valor válido.');
      return;
    }

    const paymentPercentage: PaymentPercentage | null =
      payment === 0 || payment === 50 || payment === 100 ? payment : null;

    if (paymentPercentage === null) {
      this.showNotice('Selecione uma opção de pagamento válida.');
      return;
    }

    if (this.bookings.some((booking) => booking.date === date && booking.date !== this.editingDate)) {
      this.showNotice('Este dia já está reservado. Selecione outra data.');
      return;
    }

    const updatedBookings = this.bookings.filter(
      (booking) => booking.date !== this.editingDate,
    );
    updatedBookings.push({
      date,
      name,
      phone: this.phone.trim(),
      value,
      payment: paymentPercentage,
    });

    if (!this.persistBookings(updatedBookings)) {
      this.showNotice('Não foi possível salvar a reserva neste navegador.');
      return;
    }

    this.bookings = updatedBookings;
    const [year, month] = date.split('-').map(Number);
    this.year = year;
    this.month = month - 1;
    this.resetForm();
    this.noticeType = 'success';
    this.notice = 'Reserva salva com sucesso.';
  }

  deleteBooking(): void {
    if (!this.editingDate || !window.confirm('Excluir esta reserva?')) {
      return;
    }

    const updatedBookings = this.bookings.filter(
      (booking) => booking.date !== this.editingDate,
    );

    if (!this.persistBookings(updatedBookings)) {
      this.showNotice('Não foi possível excluir a reserva neste navegador.');
      return;
    }

    this.bookings = updatedBookings;
    this.resetForm();
  }

  statusLabel(booking: Booking): string {
    if (booking.payment === 100) {
      return '100% pago';
    }
    return booking.payment === 50 ? '50% pago' : 'Não pago';
  }

  private loadBookings(): Booking[] {
    try {
      const saved = localStorage.getItem(this.storageKey);
      const data: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(data)
        ? data.filter((item: unknown): item is Booking => this.isBooking(item))
        : [];
    } catch {
      return [];
    }
  }

  private isBooking(value: unknown): value is Booking {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const booking = value as Record<string, unknown>;
    return (
      typeof booking['date'] === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(booking['date']) &&
      typeof booking['name'] === 'string' &&
      typeof booking['phone'] === 'string' &&
      typeof booking['value'] === 'number' &&
      Number.isFinite(booking['value']) &&
      (booking['payment'] === 0 || booking['payment'] === 50 || booking['payment'] === 100)
    );
  }

  private persistBookings(bookings: Booking[]): boolean {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(bookings));
      return true;
    } catch {
      return false;
    }
  }

  private showNotice(message: string): void {
    this.noticeType = 'error';
    this.notice = message;
  }

  private clearNotice(): void {
    this.notice = '';
    this.noticeType = 'error';
  }

  private formatDate(year: number, month: number, day: number): string {
    return `${year}-${this.pad(month + 1)}-${this.pad(day)}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
