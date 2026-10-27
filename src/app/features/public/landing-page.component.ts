import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { PublicStatsStore } from '../../core/data/public-stats.store';
import { dayNames } from '../../core/i18n/format';
import { PlanKey } from '../../core/data/models';
import { tierViews } from '../../core/data/plans';
import { PLATFORMS } from '../../core/data/platforms';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { CycleSwitchComponent } from '../../shared/components/cycle-switch.component';
import {
  PlanCard,
  PlanCardsComponent,
} from '../../shared/components/plan-cards/plan-cards.component';

@Component({
  selector: 'app-landing-page',
  imports: [PlanCardsComponent, CycleSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsStore);
  private readonly admin = inject(AdminStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  // The landing page promises Facebook groups and pages only; LINE chats are a workspace feature (Pro and above).
  protected readonly platforms = [PLATFORMS.fb];
  private readonly publicStats = inject(PublicStatsStore);
  protected readonly stats = this.publicStats.state;
  protected readonly kpis = computed(() => {
    const labels = this.t().api;
    const stats = this.publicStats.stats();
    return [
      { label: labels.landSent, value: stats ? stats.postsSent7d.toLocaleString() : '—' },
      {
        label: labels.landRate,
        value: stats?.successRate7d == null ? '—' : `${stats.successRate7d.toFixed(1)}%`,
      },
      {
        label: labels.landDevices,
        value: stats ? stats.devicesActive24h.toLocaleString() : '—',
      },
    ];
  });
  protected readonly bars = computed(() =>
    this.publicStats.bars().map((bar) => ({
      ...bar,
      label: dayNames(this.i18n.li())[bar.date.getDay()],
    })),
  );

  constructor() {
    void this.publicStats.load();
  }

  protected readonly steps = computed(() => {
    const l = this.t().land;
    return [
      [l.s1t, l.s1b],
      [l.s2t, l.s2b],
      [l.s3t, l.s3b],
    ];
  });
  protected readonly features = computed(() => {
    const l = this.t().land;
    return [
      ['ph-calendar-blank', l.f1t, l.f1b],
      ['ph-images', l.f2t, l.f2b],
      ['ph-timer', l.f3t, l.f3b],
      ['ph-gauge', l.f4t, l.f4b],
      ['ph-wifi-slash', l.f5t, l.f5b],
      ['ph-chart-bar', l.f6t, l.f6b],
    ];
  });
  protected readonly personas = computed(() => {
    const l = this.t().land;
    return [
      ['ph-storefront', l.p1t, l.p1b],
      ['ph-megaphone', l.p2t, l.p2b],
      ['ph-buildings', l.p3t, l.p3b],
    ];
  });

  protected readonly lang = this.i18n.lang;
  protected readonly faqs = computed(() => {
    const isThai = this.i18n.lang() === 'th';
    return isThai
      ? [
          {
            q: 'ระบบ AutoPost คืออะไร และช่วยเพิ่มยอดขายได้อย่างไร?',
            a: 'AutoPost คือแพลตฟอร์มจัดการและตั้งเวลาโพสต์ Facebook อัจฉริยะ ช่วยให้ร้านค้าและผู้ทำการตลาดออนไลน์สามารถตั้งเวลาโพสต์ล่วงหน้าลงกลุ่มและเพจ Facebook ได้อัตโนมัติ โดยไม่ต้องโพสต์ด้วยตนเอง ประหยัดเวลาและช่วยเข้าถึงลูกค้าเป้าหมายได้สม่ำเสมอ',
          },
          {
            q: 'ระบบช่วยป้องกัน Facebook บล็อกบัญชีอย่างไร (Anti-ban)?',
            a: 'AutoPost ทำงานผ่านส่วนขยายบนเบราว์เซอร์ของคุณโดยใช้ IP และเซสชันจริง จึงไม่ต้องส่งรหัสผ่านให้บุคคลที่สาม พร้อมฟังก์ชันป้องกันการบล็อกระดับสูง เช่น การจำลองความเร็วการพิมพ์แบบมนุษย์ (Human typing), สุ่มช่วงเวลาหน่วงระหว่างโพสต์ (Smart delay), สุ่มเนื้อหาข้อความ (Spintax) และหยุดโพสต์อัตโนมัติเมื่อระบบตรวจพบการเตือนจาก Facebook',
          },
          {
            q: 'สามารถตั้งเวลาโพสต์ล่วงหน้าได้กี่วัน และโพสต์ได้กี่กลุ่ม?',
            a: 'คุณสามารถจัดการชุดลิงก์กลุ่ม Facebook ได้ไม่จำกัด และตั้งตารางเวลาโพสต์ล่วงหน้าได้สูงสุด 14 วัน ระบบจะช่วยคำนวณรอบเวลาและกระจายโพสต์ตามความเหมาะสม',
          },
          {
            q: 'มีค่าใช้จ่ายอย่างไร มีแผนทดลองใช้ฟรีหรือไม่?',
            a: 'AutoPost มีแผน Free ให้เริ่มต้นใช้งานได้ฟรีตลอดชีพโดยไม่ต้องกรอกบัตรเครดิต และมีแผน Pro กับ Agency สำหรับผู้ที่ต้องการขยายจำนวนกลุ่มหรือจำนวนอุปกรณ์',
          },
          {
            q: 'ต้องติดตั้งโปรแกรมอะไรบนเครื่องหรือไม่?',
            a: 'เพียงติดตั้งส่วนขยาย AutoPost บน Google Chrome หรือ Chromium ในเครื่องที่คุณเข้าสู่ระบบ Facebook ไว้อยู่แล้ว แล้วเชื่อมต่อกับแดชบอร์ดผ่านรหัสจับคู่เพียงครั้งเดียว ก็สามารถสั่งงานจากที่ไหนก็ได้ทันที',
          },
        ]
      : [
          {
            q: 'What is AutoPost and how does it help grow sales?',
            a: 'AutoPost is a smart Facebook scheduling and automation platform designed to help online sellers and marketers schedule posts to Facebook groups and pages automatically, saving time and reaching audiences consistently.',
          },
          {
            q: 'How does the system prevent Facebook account bans (Anti-ban)?',
            a: 'AutoPost operates through your browser extension using your real IP and session, keeping your passwords safe. It incorporates advanced anti-ban safeguards including human typing simulation, smart random delays, spintax message variations, and automatic pausing upon warnings.',
          },
          {
            q: 'How many days in advance can I schedule, and to how many groups?',
            a: 'You can manage unlimited group link sets and schedule posts up to 14 days in advance with automatic pacing and queue distribution.',
          },
          {
            q: 'How much does it cost, and is there a free plan?',
            a: 'AutoPost offers a permanent free tier with no credit card required, as well as Pro and Agency tiers for scaling groups and multiple devices.',
          },
          {
            q: 'Do I need to install any software on my computer?',
            a: 'Simply install the AutoPost extension in Google Chrome where you are already signed in to Facebook, and pair with the dashboard once using a pairing code.',
          },
        ];
  });

  protected readonly tiers = computed<PlanCard[]>(() => {
    const t = this.t();
    return tierViews(this.admin.plans(), this.settings.bill().cycle, t).map((p) => ({
      ...p,
      highlighted: p.k === 'pro',
      variant: p.k === 'pro' ? 'primary' : 'secondary',
      cta: p.k === 'free' ? t.land.trial : t.common.choose,
    }));
  });

  protected startTrial(plan: PlanKey = 'free'): void {
    void this.router.navigate(['/signup'], { queryParams: { plan } });
  }

  protected scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 72,
        behavior: 'smooth',
      });
  }
}
