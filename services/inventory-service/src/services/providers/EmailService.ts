import nodemailer from 'nodemailer';
import { config } from '../../config';
import logger from '../../utils/logger';

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure, // true for 465, false for other ports
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  // Verify email service connection
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
    } catch (error) {
      logger.error('Email service connection verification failed:', error);
    }
  }

  // Send email
  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: emailData.from || config.email.from,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || emailData.text.replace(/\n/g, '<br>')
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully to ${emailData.to}`, {
        messageId: result.messageId,
        subject: emailData.subject
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      logger.error(`Failed to send email to ${emailData.to}:`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send bulk emails
  async sendBulkEmails(emails: EmailData[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    // Process emails in batches to avoid overwhelming the server
    const batchSize = 5;
    const batches = this.chunkArray(emails, batchSize);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(email => this.sendEmail(email))
      );
      results.push(...batchResults);

      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(1000); // 1 second delay
      }
    }

    return results;
  }

  // Send email with template
  async sendTemplatedEmail(
    to: string,
    templateName: string,
    templateData: any,
    subject?: string
  ): Promise<EmailResult> {
    try {
      // Load email template
      const template = await this.loadEmailTemplate(templateName);
      
      if (!template) {
        throw new Error(`Email template '${templateName}' not found`);
      }

      // Replace template variables
      const html = this.replaceTemplateVariables(template.html, templateData);
      const text = this.replaceTemplateVariables(template.text, templateData);
      const emailSubject = subject || this.replaceTemplateVariables(template.subject, templateData);

      return await this.sendEmail({
        to,
        subject: emailSubject,
        text,
        html
      });

    } catch (error) {
      logger.error(`Failed to send templated email to ${to}:`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load email template from database or file system
  private async loadEmailTemplate(templateName: string): Promise<{
    subject: string;
    html: string;
    text: string;
  } | null> {
    try {
      // You can load from database or file system
      // For now, return a basic template structure
      
      const templates: { [key: string]: any } = {
        'stock_alert': {
          subject: 'แจ้งเตือนสต๊อค - {{product_name}}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h2 style="color: #dc3545;">{{alert_title}}</h2>
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>สินค้า:</strong> {{product_name}} ({{product_sku}})</p>
                  <p><strong>สาขา:</strong> {{branch_name}}</p>
                  <p><strong>สต๊อคปัจจุบัน:</strong> {{current_stock}} {{unit}}</p>
                  <p><strong>เกณฑ์แจ้งเตือน:</strong> {{threshold_level}} {{unit}}</p>
                  {{#if suggested_quantity}}
                  <p><strong>แนะนำสั่งซื้อ:</strong> {{suggested_quantity}} {{unit}}</p>
                  {{/if}}
                </div>
                <p>{{message}}</p>
                <div style="margin-top: 20px; font-size: 12px; color: #666;">
                  <p>ระบบจัดการสต๊อคผลไม้อบแห้ง<br>
                  ส่งเมื่อ: {{date}} {{time}}</p>
                </div>
              </div>
            </div>
          `,
          text: `
{{alert_title}}

สินค้า: {{product_name}} ({{product_sku}})
สาขา: {{branch_name}}
สต๊อคปัจจุบัน: {{current_stock}} {{unit}}
เกณฑ์แจ้งเตือน: {{threshold_level}} {{unit}}
{{#if suggested_quantity}}แนะนำสั่งซื้อ: {{suggested_quantity}} {{unit}}{{/if}}

{{message}}

ระบบจัดการสต๊อคผลไม้อบแห้ง
ส่งเมื่อ: {{date}} {{time}}
          `
        }
      };

      return templates[templateName] || null;

    } catch (error) {
      logger.error(`Error loading email template '${templateName}':`, error);
      return null;
    }
  }

  // Replace template variables
  private replaceTemplateVariables(template: string, data: any): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(placeholder, String(value || ''));
    }
    
    // Handle conditional blocks (basic implementation)
    result = result.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, condition, content) => {
      return data[condition] ? content : '';
    });
    
    return result;
  }

  // Test email configuration
  async testEmailConfiguration(): Promise<EmailResult> {
    try {
      await this.verifyConnection();

      // Send test email to configured admin email
      const testResult = await this.sendEmail({
        to: config.email.from,
        subject: 'ทดสอบระบบส่งอีเมล',
        text: 'นี่คือการทดสอบระบบการส่งอีเมลแจ้งเตือนสต๊อค\n\nระบบทำงานปกติ',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>ทดสอบระบบส่งอีเมล</h2>
            <p>นี่คือการทดสอบระบบการส่งอีเมลแจ้งเตือนสต๊อค</p>
            <p><strong>ระบบทำงานปกติ</strong></p>
            <p><small>ส่งเมื่อ: ${new Date().toLocaleString('th-TH')}</small></p>
          </div>
        `
      });

      return testResult;

    } catch (error) {
      logger.error('Email configuration test failed:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get email service status
  getStatus(): {
    configured: boolean;
    host: string;
    port: number;
    secure: boolean;
    from: string;
  } {
    return {
      configured: !!(config.email.host && config.email.user && config.email.password),
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      from: config.email.from
    };
  }

  // Utility function to chunk array
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Utility function for delay
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default EmailService;