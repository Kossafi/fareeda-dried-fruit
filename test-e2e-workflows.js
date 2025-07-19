#!/usr/bin/env node

/**
 * End-to-End Workflow Testing Script
 * Tests complete business workflows for the dried fruits inventory system
 */

const axios = require('axios');
const fs = require('fs');

// Configuration
const config = {
  baseUrl: 'http://localhost:3000/api',
  timeout: 30000,
  testUser: {
    email: 'chairman@driedfruits.com',
    password: 'password123'
  }
};

let authToken = null;
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

console.log('🧪 End-to-End Workflow Testing');
console.log('================================');

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function recordTest(name, passed, error = null) {
  testResults.tests.push({
    name,
    passed,
    error: error?.message || null,
    timestamp: new Date().toISOString()
  });
  
  if (passed) {
    testResults.passed++;
    log(`Test passed: ${name}`, 'success');
  } else {
    testResults.failed++;
    log(`Test failed: ${name} - ${error?.message}`, 'error');
  }
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${config.baseUrl}${endpoint}`,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw new Error(`HTTP ${error.response?.status}: ${error.response?.data?.message || error.message}`);
  }
}

// Test 1: Authentication Flow
async function testAuthentication() {
  log('Testing authentication flow...');
  
  try {
    const response = await makeRequest('POST', '/auth/login', {
      email: config.testUser.email,
      password: config.testUser.password
    });
    
    if (response.success && response.data.token) {
      authToken = response.data.token;
      recordTest('User authentication', true);
      return true;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    recordTest('User authentication', false, error);
    return false;
  }
}

// Test 2: Inventory Management Flow
async function testInventoryManagement() {
  log('Testing inventory management workflow...');
  
  try {
    // Get branches
    const branchesResponse = await makeRequest('GET', '/branches');
    if (!branchesResponse.success || !branchesResponse.data.length) {
      throw new Error('No branches found');
    }
    const branchId = branchesResponse.data[0].id;
    recordTest('Fetch branches', true);
    
    // Get products
    const productsResponse = await makeRequest('GET', '/products');
    if (!productsResponse.success || !productsResponse.data.length) {
      throw new Error('No products found');
    }
    const productId = productsResponse.data[0].id;
    recordTest('Fetch products', true);
    
    // Get inventory stocks
    const stocksResponse = await makeRequest('GET', `/inventory/stocks?branchId=${branchId}`);
    if (!stocksResponse.success) {
      throw new Error('Failed to fetch inventory stocks');
    }
    recordTest('Fetch inventory stocks', true);
    
    // Create inventory movement
    const movementData = {
      branchId,
      productId,
      movementType: 'adjustment',
      quantity: 10,
      notes: 'E2E test adjustment'
    };
    
    const movementResponse = await makeRequest('POST', '/inventory/movements', movementData);
    if (!movementResponse.success) {
      throw new Error('Failed to create inventory movement');
    }
    recordTest('Create inventory movement', true);
    
    return true;
  } catch (error) {
    recordTest('Inventory management flow', false, error);
    return false;
  }
}

// Test 3: Sales Recording Flow
async function testSalesFlow() {
  log('Testing sales recording workflow...');
  
  try {
    // Get branch and products for sale
    const branchesResponse = await makeRequest('GET', '/branches');
    const branchId = branchesResponse.data[0].id;
    
    const productsResponse = await makeRequest('GET', '/products');
    const product = productsResponse.data[0];
    
    // Create sale
    const saleData = {
      branchId,
      customerType: 'walk_in',
      paymentMethod: 'cash',
      items: [{
        productId: product.id,
        quantity: 100, // 100 grams
        unitPrice: product.unit_price,
        discountPercentage: 0
      }]
    };
    
    const saleResponse = await makeRequest('POST', '/sales', saleData);
    if (!saleResponse.success) {
      throw new Error('Failed to create sale');
    }
    recordTest('Create sales transaction', true);
    
    // Verify sale was recorded
    const salesResponse = await makeRequest('GET', `/sales?branchId=${branchId}&limit=1`);
    if (!salesResponse.success || !salesResponse.data.length) {
      throw new Error('Sale not found in records');
    }
    recordTest('Verify sale recording', true);
    
    return true;
  } catch (error) {
    recordTest('Sales recording flow', false, error);
    return false;
  }
}

// Test 4: Alert System Flow
async function testAlertSystem() {
  log('Testing alert system workflow...');
  
  try {
    // Get active alerts
    const alertsResponse = await makeRequest('GET', '/alerts');
    if (!alertsResponse.success) {
      throw new Error('Failed to fetch alerts');
    }
    recordTest('Fetch stock alerts', true);
    
    // If alerts exist, test acknowledgment
    if (alertsResponse.data.length > 0) {
      const alertId = alertsResponse.data[0].id;
      
      const ackResponse = await makeRequest('POST', `/alerts/${alertId}/acknowledge`, {
        notes: 'E2E test acknowledgment'
      });
      
      if (!ackResponse.success) {
        throw new Error('Failed to acknowledge alert');
      }
      recordTest('Acknowledge alert', true);
    }
    
    // Get alert thresholds
    const thresholdsResponse = await makeRequest('GET', '/alerts/thresholds');
    if (!thresholdsResponse.success) {
      throw new Error('Failed to fetch alert thresholds');
    }
    recordTest('Fetch alert thresholds', true);
    
    return true;
  } catch (error) {
    recordTest('Alert system flow', false, error);
    return false;
  }
}

// Test 5: Sampling Management Flow
async function testSamplingFlow() {
  log('Testing sampling management workflow...');
  
  try {
    // Get branches and products
    const branchesResponse = await makeRequest('GET', '/branches');
    const branchId = branchesResponse.data[0].id;
    
    const productsResponse = await makeRequest('GET', '/products');
    const product = productsResponse.data[0];
    
    // Create sampling session
    const sessionData = {
      branchId,
      customerCount: 3,
      sessionNotes: 'E2E test sampling session'
    };
    
    const sessionResponse = await makeRequest('POST', '/sampling/sessions', sessionData);
    if (!sessionResponse.success) {
      throw new Error('Failed to create sampling session');
    }
    const sessionId = sessionResponse.data.id;
    recordTest('Create sampling session', true);
    
    // Record sampling
    const samplingData = {
      samplingSessionId: sessionId,
      productId: product.id,
      weightGram: 15.5
    };
    
    const samplingResponse = await makeRequest('POST', '/sampling/records', samplingData);
    if (!samplingResponse.success) {
      throw new Error('Failed to record sampling');
    }
    recordTest('Record product sampling', true);
    
    // Get sampling history
    const historyResponse = await makeRequest('GET', `/sampling/sessions?branchId=${branchId}`);
    if (!historyResponse.success) {
      throw new Error('Failed to fetch sampling history');
    }
    recordTest('Fetch sampling history', true);
    
    return true;
  } catch (error) {
    recordTest('Sampling management flow', false, error);
    return false;
  }
}

// Test 6: Procurement Flow
async function testProcurementFlow() {
  log('Testing procurement workflow...');
  
  try {
    // Get suppliers
    const suppliersResponse = await makeRequest('GET', '/procurement/suppliers');
    if (!suppliersResponse.success || !suppliersResponse.data.length) {
      throw new Error('No suppliers found');
    }
    const supplier = suppliersResponse.data[0];
    recordTest('Fetch suppliers', true);
    
    // Get products
    const productsResponse = await makeRequest('GET', '/products');
    const product = productsResponse.data[0];
    
    // Create purchase order
    const poData = {
      supplierId: supplier.id,
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      items: [{
        productId: product.id,
        quantity: 1000,
        unitCost: product.cost_price,
        notes: 'E2E test order'
      }],
      deliveryAddress: 'Test warehouse address'
    };
    
    const poResponse = await makeRequest('POST', '/procurement/orders', poData);
    if (!poResponse.success) {
      throw new Error('Failed to create purchase order');
    }
    const poId = poResponse.data.id;
    recordTest('Create purchase order', true);
    
    // Test approval workflow
    const approvalResponse = await makeRequest('POST', `/procurement/orders/${poId}/approve`, {
      comments: 'E2E test approval'
    });
    if (!approvalResponse.success) {
      throw new Error('Failed to approve purchase order');
    }
    recordTest('Approve purchase order', true);
    
    // Get procurement history
    const historyResponse = await makeRequest('GET', '/procurement/orders');
    if (!historyResponse.success) {
      throw new Error('Failed to fetch procurement history');
    }
    recordTest('Fetch procurement history', true);
    
    return true;
  } catch (error) {
    recordTest('Procurement workflow', false, error);
    return false;
  }
}

// Test 7: Reporting and Analytics Flow
async function testReportingFlow() {
  log('Testing reporting and analytics workflow...');
  
  try {
    // Get sales analytics
    const salesAnalyticsResponse = await makeRequest('GET', '/reports/sales-analytics?period=last_30_days');
    if (!salesAnalyticsResponse.success) {
      throw new Error('Failed to generate sales analytics');
    }
    recordTest('Generate sales analytics', true);
    
    // Get inventory movement report
    const inventoryResponse = await makeRequest('GET', '/reports/inventory-movement?period=last_30_days');
    if (!inventoryResponse.success) {
      throw new Error('Failed to generate inventory movement report');
    }
    recordTest('Generate inventory movement report', true);
    
    // Get branch performance report
    const branchResponse = await makeRequest('GET', '/reports/branch-performance?period=last_30_days');
    if (!branchResponse.success) {
      throw new Error('Failed to generate branch performance report');
    }
    recordTest('Generate branch performance report', true);
    
    // Get real-time dashboard
    const dashboardResponse = await makeRequest('GET', '/reports/real-time-dashboard');
    if (!dashboardResponse.success) {
      throw new Error('Failed to fetch real-time dashboard');
    }
    recordTest('Fetch real-time dashboard', true);
    
    // Test report export
    const exportData = {
      reportType: 'sales_analytics',
      format: 'json',
      parameters: {
        period: 'last_7_days'
      }
    };
    
    const exportResponse = await makeRequest('POST', '/reports/export', exportData);
    if (!exportResponse.success) {
      throw new Error('Failed to export report');
    }
    recordTest('Export report', true);
    
    return true;
  } catch (error) {
    recordTest('Reporting and analytics flow', false, error);
    return false;
  }
}

// Test 8: System Health Check
async function testSystemHealth() {
  log('Testing system health and performance...');
  
  try {
    // Health check
    const healthResponse = await makeRequest('GET', '/health');
    if (!healthResponse.success) {
      throw new Error('Health check failed');
    }
    recordTest('System health check', true);
    
    // Cache statistics
    const cacheResponse = await makeRequest('GET', '/reports/cache/statistics');
    if (!cacheResponse.success) {
      throw new Error('Failed to get cache statistics');
    }
    recordTest('Cache statistics', true);
    
    // Performance test - multiple concurrent requests
    const concurrentRequests = Array(5).fill().map(() => 
      makeRequest('GET', '/products')
    );
    
    const results = await Promise.all(concurrentRequests);
    if (results.every(r => r.success)) {
      recordTest('Concurrent request handling', true);
    } else {
      throw new Error('Some concurrent requests failed');
    }
    
    return true;
  } catch (error) {
    recordTest('System health and performance', false, error);
    return false;
  }
}

// Main test execution
async function runAllTests() {
  log('Starting comprehensive end-to-end testing...');
  
  const tests = [
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Inventory Management', fn: testInventoryManagement },
    { name: 'Sales Recording', fn: testSalesFlow },
    { name: 'Alert System', fn: testAlertSystem },
    { name: 'Sampling Management', fn: testSamplingFlow },
    { name: 'Procurement', fn: testProcurementFlow },
    { name: 'Reporting & Analytics', fn: testReportingFlow },
    { name: 'System Health', fn: testSystemHealth }
  ];
  
  for (const test of tests) {
    log(`Running ${test.name} tests...`);
    try {
      await test.fn();
    } catch (error) {
      log(`Test suite ${test.name} encountered an error: ${error.message}`, 'error');
    }
    log(''); // Empty line for readability
  }
  
  // Generate test report
  const report = {
    summary: {
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: `${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`
    },
    tests: testResults.tests,
    timestamp: new Date().toISOString()
  };
  
  // Save report to file
  fs.writeFileSync('e2e-test-report.json', JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`✅ Passed: ${report.summary.passed}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`📈 Success Rate: ${report.summary.successRate}`);
  console.log(`📄 Detailed report saved to: e2e-test-report.json`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`  • ${test.name}: ${test.error}`);
      });
  }
  
  return testResults.failed === 0;
}

// Execute if run directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`Critical error: ${error.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { runAllTests };