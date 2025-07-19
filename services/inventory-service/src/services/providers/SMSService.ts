import axios from 'axios';
import { config } from '../../config';
import logger from '../../utils/logger';

interface SMSData {
  to: string;
  message: string;
  from?: string;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSService {
  private apiKey: string;
  private apiUrl: string;
  private sender: string;

  constructor() {
    this.apiKey = config.sms.apiKey;
    this.apiUrl = config.sms.apiUrl;
    this.sender = config.sms.sender;
  }

  // Send SMS
  async sendSMS(smsData: SMSData): Promise<SMSResult> {
    try {
      // Format phone number (remove leading 0 and add country code)
      const formattedPhone = this.formatPhoneNumber(smsData.to);
      
      if (!formattedPhone) {
        throw new Error('Invalid phone number format');
      }

      // Truncate message if too long (SMS limit is usually 160 characters)
      const truncatedMessage = this.truncateMessage(smsData.message, 160);

      // Prepare SMS payload based on provider
      const payload = this.prepareSMSPayload({
        to: formattedPhone,
        message: truncatedMessage,
        from: smsData.from || this.sender
      });

      // Send SMS via HTTP API
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      // Parse response based on provider
      const result = this.parseSMSResponse(response.data);

      if (result.success) {
        logger.info(`SMS sent successfully to ${formattedPhone}`, {
          messageId: result.messageId,
          originalPhone: smsData.to
        });
      } else {
        logger.error(`Failed to send SMS to ${formattedPhone}:`, result.error);
      }

      return result;

    } catch (error) {
      logger.error(`SMS sending error for ${smsData.to}:`, error);

      return {
        success: false,
        error: error.message || 'Unknown SMS sending error'
      };
    }
  }

  // Send bulk SMS
  async sendBulkSMS(smsMessages: SMSData[]): Promise<SMSResult[]> {
    const results: SMSResult[] = [];

    // Process SMS in batches to avoid rate limiting
    const batchSize = 10;
    const batches = this.chunkArray(smsMessages, batchSize);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(sms => this.sendSMS(sms))
      );
      results.push(...batchResults);

      // Delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(1000); // 1 second delay
      }
    }

    return results;
  }

  // Format phone number for Thailand (+66)
  private formatPhoneNumber(phone: string): string | null {
    try {
      // Remove all non-numeric characters
      const cleaned = phone.replace(/\D/g, '');
      
      // Handle Thai phone numbers
      if (cleaned.startsWith('66')) {
        // Already has country code
        return `+${cleaned}`;
      } else if (cleaned.startsWith('0') && cleaned.length === 10) {
        // Remove leading 0 and add Thailand country code
        return `+66${cleaned.substring(1)}`;
      } else if (cleaned.length === 9) {
        // Missing leading 0, add Thailand country code
        return `+66${cleaned}`;
      }

      // Invalid format
      return null;

    } catch (error) {
      logger.error('Error formatting phone number:', error);
      return null;
    }
  }

  // Truncate message to fit SMS character limit
  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) {
      return message;
    }

    // Truncate and add ellipsis
    return message.substring(0, maxLength - 3) + '...';
  }

  // Prepare SMS payload based on provider
  private prepareSMSPayload(smsData: {
    to: string;
    message: string;
    from: string;
  }): any {
    // This is a generic payload structure
    // Adjust based on your SMS provider's API requirements
    
    if (config.sms.provider === 'twilio') {
      return {
        To: smsData.to,
        From: smsData.from,
        Body: smsData.message
      };
    } else if (config.sms.provider === 'nexmo') {
      return {
        to: smsData.to,
        from: smsData.from,
        text: smsData.message
      };
    } else if (config.sms.provider === 'thai_sms') {
      // Common Thai SMS provider format
      return {
        msisdn: smsData.to,
        message: smsData.message,
        sender: smsData.from,
        force: 'standard'
      };
    } else {
      // Generic format
      return {
        to: smsData.to,
        from: smsData.from,
        message: smsData.message
      };
    }
  }

  // Parse SMS response based on provider
  private parseSMSResponse(responseData: any): SMSResult {
    try {
      // Twilio response format
      if (responseData.sid) {
        return {
          success: true,
          messageId: responseData.sid
        };
      }

      // Nexmo response format
      if (responseData.messages && responseData.messages[0]) {
        const message = responseData.messages[0];
        return {
          success: message.status === '0',
          messageId: message['message-id'],
          error: message.status !== '0' ? message['error-text'] : undefined
        };
      }

      // Thai SMS provider response format
      if (responseData.status !== undefined) {
        return {
          success: responseData.status === 'success' || responseData.status === true,
          messageId: responseData.message_id || responseData.id,
          error: responseData.status !== 'success' ? responseData.message : undefined
        };
      }

      // Generic success response
      if (responseData.success === true || responseData.status === 'sent') {
        return {
          success: true,
          messageId: responseData.id || responseData.messageId || 'unknown'
        };
      }

      // Generic error response
      return {
        success: false,
        error: responseData.error || responseData.message || 'Unknown SMS provider error'
      };

    } catch (error) {
      logger.error('Error parsing SMS response:', error);
      return {
        success: false,
        error: 'Failed to parse SMS response'
      };
    }
  }

  // Send templated SMS
  async sendTemplatedSMS(
    to: string,
    templateName: string,
    templateData: any
  ): Promise<SMSResult> {
    try {
      const template = this.getSMSTemplate(templateName);
      
      if (!template) {
        throw new Error(`SMS template '${templateName}' not found`);
      }

      // Replace template variables
      const message = this.replaceTemplateVariables(template, templateData);

      return await this.sendSMS({
        to,
        message
      });

    } catch (error) {
      logger.error(`Failed to send templated SMS to ${to}:`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get SMS template
  private getSMSTemplate(templateName: string): string | null {
    const templates: { [key: string]: string } = {
      'low_stock': 'แจ้งเตือน: {{product_name}} ที่ {{branch_name}} เหลือ {{current_stock}} {{unit}} (ต่ำกว่าเกณฑ์ {{threshold_level}} {{unit}})',
      'out_of_stock': 'ด่วน! {{product_name}} ที่ {{branch_name}} หมดสต๊อค! แนะนำสั่งซื้อ {{suggested_quantity}} {{unit}} โดยด่วน',
      'approaching_expiry': 'แจ้งเตือน: {{product_name}} ที่ {{branch_name}} ใกล้หมดอายุ ({{days_to_expiry}} วัน) เหลือ {{current_stock}} {{unit}}',
      'test': 'ทดสอบระบบ SMS: ระบบแจ้งเตือนสต๊อคทำงานปกติ เวลา {{time}}'
    };

    return templates[templateName] || null;
  }

  // Replace template variables
  private replaceTemplateVariables(template: string, data: any): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(placeholder, String(value || ''));
    }
    
    return result;
  }

  // Test SMS configuration
  async testSMSConfiguration(testPhone?: string): Promise<SMSResult> {
    try {
      const phone = testPhone || config.sms.testPhone;
      
      if (!phone) {
        throw new Error('No test phone number configured');
      }

      const testResult = await this.sendTemplatedSMS(phone, 'test', {
        time: new Date().toLocaleString('th-TH')
      });

      return testResult;

    } catch (error) {
      logger.error('SMS configuration test failed:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get SMS service status
  getStatus(): {
    configured: boolean;
    provider: string;
    sender: string;
    apiUrl: string;
  } {
    return {
      configured: !!(this.apiKey && this.apiUrl),
      provider: config.sms.provider,
      sender: this.sender,
      apiUrl: this.apiUrl
    };
  }

  // Check if phone number is valid Thai mobile number
  isValidThaiMobile(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    
    // Thai mobile numbers start with 06, 08, or 09
    const thaiMobilePattern = /^(66)?(0)?[689]\d{8}$/;
    
    return thaiMobilePattern.test(cleaned);
  }

  // Get SMS character count (accounting for Thai characters)
  getCharacterCount(message: string): {
    count: number;
    segments: number;
    encoding: 'GSM' | 'UCS2';
  } {
    // Check if message contains Thai characters or special characters
    const hasThaiOrSpecial = /[ก-๙\u0E00-\u0E7F]/.test(message);
    
    if (hasThaiOrSpecial) {
      // UCS2 encoding - 70 characters per segment
      const count = message.length;
      const segments = Math.ceil(count / 70);
      return { count, segments, encoding: 'UCS2' };
    } else {
      // GSM encoding - 160 characters per segment
      const count = message.length;
      const segments = Math.ceil(count / 160);
      return { count, segments, encoding: 'GSM' };
    }
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

export default SMSService;