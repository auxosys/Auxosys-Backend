const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { validateClient, DEFAULT_STATUS } = require('../utils/clientModel');

const SPREADSHEET_ID = process.env.GOOGLE_CLIENTS_SHEET_ID || '1zbIDm7T4vbrHCxaWOkmjTLP5Tqq68P5RSdkt-8g7nNk';
const SHEET_TAB_NAME = 'Clients';

const HEADERS = [
  'ID',
  'Company Name',
  'Contact Person',
  'Email',
  'Phone Code',
  'Phone',
  'WhatsApp Code',
  'WhatsApp',
  'Website',
  'Industry',
  'Status',
  'Services',
  'Custom Services',
  'Address',
  'City',
  'State',
  'Country',
  'Notes',
  'Sort Order',
  'Is Archived',
  'Added By',
  'Created At',
  'Updated At',
  'Status History'
];

class GoogleSheetsService {
  constructor() {
    this.keyFilePath = path.join(__dirname, '../google-credentials.json');
    this.isConfigured = fs.existsSync(this.keyFilePath);
    this.sheets = null;
    this.sheetIdNum = 0; // The numeric sheetId inside the spreadsheet
    this.initPromise = null;
  }

  async getSheetsClient() {
    if (this.sheets) return this.sheets;

    let authConfig = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    };

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const creds = typeof process.env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string'
          ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
          : process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        authConfig.credentials = creds;
      } catch (e) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY env:', e.message);
      }
    } else if (fs.existsSync(this.keyFilePath)) {
      authConfig.keyFile = this.keyFilePath;
    } else if (fs.existsSync('/etc/secrets/google-credentials.json')) {
      authConfig.keyFile = '/etc/secrets/google-credentials.json';
    } else {
      throw new Error('Google Credentials not found (missing google-credentials.json or GOOGLE_SERVICE_ACCOUNT_KEY)');
    }

    const auth = new google.auth.GoogleAuth(authConfig);
    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  async ensureInitialized() {
    if (!this.initPromise) {
      this.initPromise = this._initSheet();
    }
    return this.initPromise;
  }

  async _initSheet() {
    const sheets = await this.getSheetsClient();

    // 1. Get spreadsheet metadata to check sheet names
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetList = meta.data.sheets || [];
    let clientsSheet = sheetList.find(s => s.properties.title === SHEET_TAB_NAME);

    if (!clientsSheet) {
      // If Sheet1 exists, rename it to Clients. Otherwise add Clients sheet.
      const firstSheet = sheetList[0];
      if (firstSheet && firstSheet.properties.title === 'Sheet1') {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: firstSheet.properties.sheetId,
                    title: SHEET_TAB_NAME,
                  },
                  fields: 'title',
                },
              },
            ],
          },
        });
        this.sheetIdNum = firstSheet.properties.sheetId;
      } else {
        const addRes = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SHEET_TAB_NAME,
                  },
                },
              },
            ],
          },
        });
        this.sheetIdNum = addRes.data.replies[0].addSheet.properties.sheetId;
      }
    } else {
      this.sheetIdNum = clientsSheet.properties.sheetId;
    }

    // 2. Check if headers exist in row 1
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB_NAME}!A1:X1`,
    });

    const currentHeaders = headerCheck.data.values?.[0] || [];
    if (currentHeaders.length === 0 || currentHeaders[0] !== 'ID') {
      // Write header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_TAB_NAME}!A1:X1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [HEADERS],
        },
      });

      // Format headers: Navy header with white bold text, freeze row 1
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: this.sheetIdNum,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
              {
                repeatCell: {
                  range: {
                    sheetId: this.sheetIdNum,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: HEADERS.length,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.08, green: 0.16, blue: 0.35 }, // #14285A
                      textFormat: {
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                        bold: true,
                        fontSize: 10,
                      },
                      horizontalAlignment: 'CENTER',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                },
              },
              {
                repeatCell: {
                  range: {
                    sheetId: this.sheetIdNum,
                    startRowIndex: 1,
                    endRowIndex: 1000,
                    startColumnIndex: 0,
                    endColumnIndex: HEADERS.length,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 1, green: 1, blue: 1 }, // Clean White
                      textFormat: {
                        foregroundColor: { red: 0.1, green: 0.12, blue: 0.15 },
                        bold: false,
                        fontSize: 10,
                      },
                      horizontalAlignment: 'LEFT',
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
                },
              },
            ],
          },
        });
      } catch (styleErr) {
        console.warn('Could not apply header styling (non-fatal):', styleErr.message);
      }
    }
  }

  _ensureText(val) {
    if (val === undefined || val === null || val === '') return '';
    const s = String(val);
    if (s.startsWith('+') || s.startsWith('0')) {
      return `'${s}`;
    }
    return s;
  }

  _cleanText(val) {
    if (val === undefined || val === null || val === '') return '';
    let s = String(val).trim();
    if (s.startsWith("'")) s = s.substring(1);
    return s;
  }

  _rowToClient(row) {
    if (!row || row.length === 0 || !row[0]) return null;

    let services = [];
    if (row[11]) {
      try {
        services = typeof row[11] === 'string' && row[11].startsWith('[')
          ? JSON.parse(row[11])
          : row[11].split(',').map(s => s.trim()).filter(Boolean);
      } catch (e) {
        services = row[11].split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    let statusHistory = [];
    if (row[23]) {
      try {
        statusHistory = JSON.parse(row[23]);
      } catch (e) {
        statusHistory = [];
      }
    }

    const sortOrderVal = row[18] !== undefined && row[18] !== '' ? parseInt(row[18], 10) : 999999;
    const isArchivedVal = String(row[19]).trim().toUpperCase() === 'TRUE';

    return {
      id: this._cleanText(row[0]),
      companyName: this._cleanText(row[1]),
      contactPerson: this._cleanText(row[2]),
      email: this._cleanText(row[3]),
      phoneCountryCode: this._cleanText(row[4]) || '+91',
      phone: this._cleanText(row[5]),
      whatsappCountryCode: this._cleanText(row[6]) || '+91',
      whatsapp: this._cleanText(row[7]),
      website: this._cleanText(row[8]),
      industry: this._cleanText(row[9]),
      status: this._cleanText(row[10]) || DEFAULT_STATUS,
      services: services,
      customServices: this._cleanText(row[12]),
      address: this._cleanText(row[13]),
      city: this._cleanText(row[14]),
      state: this._cleanText(row[15]),
      country: this._cleanText(row[16]),
      notes: this._cleanText(row[17]),
      sortOrder: isNaN(sortOrderVal) ? 999999 : sortOrderVal,
      isArchived: isArchivedVal,
      addedBy: this._cleanText(row[20]) || 'Admin',
      createdAt: this._cleanText(row[21]) || new Date().toISOString(),
      updatedAt: this._cleanText(row[22]) || new Date().toISOString(),
      statusHistory: statusHistory,
    };
  }

  _clientToRow(c) {
    const servicesStr = Array.isArray(c.services) ? c.services.join(', ') : (c.services || '');
    const historyStr = JSON.stringify(c.statusHistory || []);

    return [
      c.id || '',
      c.companyName || '',
      c.contactPerson || '',
      c.email || '',
      this._ensureText(c.phoneCountryCode || '+91'),
      this._ensureText(c.phone || ''),
      this._ensureText(c.whatsappCountryCode || '+91'),
      this._ensureText(c.whatsapp || ''),
      c.website || '',
      c.industry || '',
      c.status || DEFAULT_STATUS,
      servicesStr,
      c.customServices || '',
      c.address || '',
      c.city || '',
      c.state || '',
      c.country || '',
      c.notes || '',
      c.sortOrder !== undefined ? String(c.sortOrder) : '999999',
      c.isArchived ? 'TRUE' : 'FALSE',
      c.addedBy || 'Admin',
      c.createdAt || new Date().toISOString(),
      c.updatedAt || new Date().toISOString(),
      historyStr,
    ];
  }

  async getAllRows() {
    await this.ensureInitialized();
    const sheets = await this.getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB_NAME}!A2:X`,
    });

    return response.data.values || [];
  }

  async listClients({ search = '', status = '', archived = false, isSuperAdmin = false } = {}) {
    const rows = await this.getAllRows();
    let clients = rows.map(r => this._rowToClient(r)).filter(Boolean);

    // Filter by archived status
    if (archived === true || archived === 'true') {
      if (isSuperAdmin) {
        clients = clients.filter(c => c.isArchived === true);
      } else {
        clients = clients.filter(c => c.isArchived === false);
      }
    } else {
      clients = clients.filter(c => c.isArchived === false);
    }

    // Filter by status
    if (status) {
      clients = clients.filter(c => c.status === status);
    }

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      clients = clients.filter(c =>
        (c.companyName && c.companyName.toLowerCase().includes(s)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s)) ||
        (c.phone && c.phone.toLowerCase().includes(s))
      );
    }

    // Sort: sortOrder ascending, fallback to createdAt ascending
    clients.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    return clients;
  }

  async getClient(id) {
    const rows = await this.getAllRows();
    for (const r of rows) {
      if (r[0] === id) {
        return this._rowToClient(r);
      }
    }
    return null;
  }

  async createClient(data, actor = 'Admin') {
    await this.ensureInitialized();
    const sheets = await this.getSheetsClient();

    const now = new Date().toISOString();
    const id = uuidv4();

    const newClient = {
      id,
      companyName: (data.companyName || '').trim(),
      contactPerson: (data.contactPerson || '').trim(),
      email: (data.email || '').trim(),
      phoneCountryCode: data.phoneCountryCode || '+91',
      phone: (data.phone || '').trim(),
      whatsappCountryCode: data.whatsappCountryCode || '+91',
      whatsapp: (data.whatsapp || '').trim(),
      website: (data.website || '').trim(),
      address: (data.address || '').trim(),
      city: (data.city || '').trim(),
      state: (data.state || '').trim(),
      country: (data.country || '').trim(),
      industry: (data.industry || '').trim(),
      status: data.status || DEFAULT_STATUS,
      services: Array.isArray(data.services) ? data.services : [],
      customServices: (data.customServices || '').trim(),
      notes: (data.notes || '').trim(),
      sortOrder: data.sortOrder !== undefined ? data.sortOrder : 999999,
      isArchived: false,
      addedBy: actor,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          status: data.status || DEFAULT_STATUS,
          by: actor,
          at: now,
          note: 'Client created',
        },
      ],
    };

    const rowValues = this._clientToRow(newClient);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB_NAME}!A:X`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });

    return newClient;
  }

  async updateClient(id, data, actor = 'Admin') {
    await this.ensureInitialized();
    const sheets = await this.getSheetsClient();
    const rows = await this.getAllRows();

    let rowIndex = -1;
    let existingClient = null;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id) {
        rowIndex = i + 2; // +2 for 1-based index and header row
        existingClient = this._rowToClient(rows[i]);
        break;
      }
    }

    if (rowIndex === -1 || !existingClient) {
      throw new Error('Client not found');
    }

    const now = new Date().toISOString();
    const statusHistory = [...(existingClient.statusHistory || [])];

    if (data.status && data.status !== existingClient.status) {
      statusHistory.unshift({
        status: data.status,
        by: actor,
        at: now,
        note: data.statusNote || `Status changed from ${existingClient.status} to ${data.status}`,
      });
    }

    const updatedClient = {
      ...existingClient,
      ...data,
      id, // Immutable
      updatedAt: now,
      statusHistory,
    };

    const rowValues = this._clientToRow(updatedClient);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB_NAME}!A${rowIndex}:X${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    return updatedClient;
  }

  async deleteClient(id) {
    await this.ensureInitialized();
    const sheets = await this.getSheetsClient();
    const rows = await this.getAllRows();

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id) {
        rowIndex = i; // 0-based index for row delete request (offset by header)
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Client not found');
    }

    // Delete the row from the sheet entirely
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: this.sheetIdNum,
                dimension: 'ROWS',
                startIndex: rowIndex + 1, // +1 because row 0 is header
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });

    return { success: true, message: 'Client deleted' };
  }

  async setArchive(id, isArchived, actor = 'Admin') {
    return this.updateClient(id, { isArchived }, actor);
  }

  async reorderClients(orderedIds) {
    await this.ensureInitialized();
    const sheets = await this.getSheetsClient();
    const rows = await this.getAllRows();

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;

    const rowMap = new Map();
    rows.forEach((r, idx) => {
      if (r[0]) rowMap.set(r[0], { row: r, sheetRow: idx + 2 });
    });

    const updateData = [];
    orderedIds.forEach((id, sortIndex) => {
      const match = rowMap.get(id);
      if (match) {
        updateData.push({
          range: `${SHEET_TAB_NAME}!S${match.sheetRow}`, // Column S is Sort Order (column 19)
          values: [[String(sortIndex)]],
        });
      }
    });

    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData,
        },
      });
    }

    return { success: true };
  }

  async seedClients(clientsToSeed = []) {
    await this.ensureInitialized();
    const existing = await this.getAllRows();

    if (existing.length > 0) {
      console.log(`Sheet already contains ${existing.length} rows. Seeding skipped.`);
      return { seeded: 0, total: existing.length };
    }

    if (!Array.isArray(clientsToSeed) || clientsToSeed.length === 0) {
      return { seeded: 0, total: 0 };
    }

    const sheets = await this.getSheetsClient();
    const rows = clientsToSeed.map(c => this._clientToRow(c));

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB_NAME}!A:X`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rows,
      },
    });

    console.log(`Successfully seeded ${rows.length} client(s) into Google Sheet.`);
    return { seeded: rows.length, total: rows.length };
  }
}

module.exports = new GoogleSheetsService();
