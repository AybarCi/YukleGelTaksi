import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Tabs,
  Tab,
  Select,
  FormControl,
  InputLabel,
  MenuItem as SelectMenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Support as SupportIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Reply as ReplyIcon,
  Visibility as VisibilityIcon,

  DriveEta as DriverIcon,
  Person as CustomerIcon,
} from '@mui/icons-material';
import supportService, { SupportTicket, CustomerSupportTicket } from '../services/supportService';
import { API_CONFIG } from '../config/api';



const SupportTicketsPage: React.FC = () => {
  const [driverTickets, setDriverTickets] = useState<SupportTicket[]>([]);
  const [customerTickets, setCustomerTickets] = useState<CustomerSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [mainTab, setMainTab] = useState(0); // 0: Sürücü, 1: Müşteri
  const [statusTab, setStatusTab] = useState(0); // 0: Tümü, 1: Beklemede, 2: İşlemde, 3: Çözüldü
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDriverTicket, setSelectedDriverTicket] = useState<SupportTicket | null>(null);
  const [selectedCustomerTicket, setSelectedCustomerTicket] = useState<CustomerSupportTicket | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [resolveComment, setResolveComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [ticketToResolve, setTicketToResolve] = useState<SupportTicket | CustomerSupportTicket | null>(null);
  const [ticketToReject, setTicketToReject] = useState<SupportTicket | CustomerSupportTicket | null>(null);
  const [ticketToReply, setTicketToReply] = useState<SupportTicket | CustomerSupportTicket | null>(null);

  const fetchDriverTickets = useCallback(async () => {
    try {
      const response = await supportService.getAllTickets();
      setDriverTickets(response.tickets || []);
    } catch (err: any) {
      console.error('Sürücü destek talepleri yükleme hatası:', err);
      throw err;
    }
  }, []);

  const fetchCustomerTickets = useCallback(async () => {
    try {
      const response = await supportService.getAllCustomerTickets();
      setCustomerTickets(response.tickets || []);
    } catch (err: any) {
      console.error('Müşteri destek talepleri yükleme hatası:', err);
      throw err;
    }
  }, []);

  const fetchAllTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        fetchDriverTickets(),
        fetchCustomerTickets()
      ]);
    } catch (err: any) {
      console.error('Destek talepleri yükleme hatası:', err);
      setError(err.message || 'Destek talepleri yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [fetchDriverTickets, fetchCustomerTickets]);

  useEffect(() => {
    fetchAllTickets();
  }, [fetchAllTickets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in_progress': return 'info';
      case 'resolved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getIssueTypeLabel = (issueType: string) => {
    const types: { [key: string]: string } = {
      'technical': 'Teknik',
      'payment': 'Ödeme',
      'order': 'Sipariş',
      'account': 'Hesap',
      'other': 'Diğer'
    };
    return types[issueType] || issueType;
  };

  const getStatusLabel = (status: string) => {
    const statuses: { [key: string]: string } = {
      'pending': 'Beklemede',
      'in_progress': 'İşlemde',
      'resolved': 'Çözüldü',
      'rejected': 'Reddedildi'
    };
    return statuses[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const priorities: { [key: string]: string } = {
      'urgent': 'Acil',
      'high': 'Yüksek',
      'medium': 'Orta',
      'low': 'Düşük'
    };
    return priorities[priority] || priority;
  };

  const filterTicketsByStatus = (tickets: (SupportTicket | CustomerSupportTicket)[], status?: string): (SupportTicket | CustomerSupportTicket)[] => {
    let filtered = tickets;

    // Status filter
    if (status) {
      filtered = filtered.filter(ticket => ticket.status === status);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    // Issue type filter
    if (issueTypeFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.issue_type === issueTypeFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(ticket => {
        const searchLower = searchTerm.toLowerCase();
        const subjectMatch = ticket.subject.toLowerCase().includes(searchLower);
        const messageMatch = ticket.message.toLowerCase().includes(searchLower);
        
        if (mainTab === 0) {
          // Sürücü talepleri
          const driverTicket = ticket as SupportTicket;
          const nameMatch = driverTicket.driver_name && driverTicket.driver_name.toLowerCase().includes(searchLower);
          return subjectMatch || messageMatch || nameMatch;
        } else {
          // Müşteri talepleri
          const customerTicket = ticket as CustomerSupportTicket;
          const nameMatch = customerTicket.customer_name && customerTicket.customer_name.toLowerCase().includes(searchLower);
          return subjectMatch || messageMatch || nameMatch;
        }
      });
    }

    return filtered;
  };

  const getCurrentTickets = () => {
    const tickets = mainTab === 0 ? driverTickets : customerTickets;
    
    switch (statusTab) {
      case 0: return filterTicketsByStatus(tickets); // Tümü
      case 1: return filterTicketsByStatus(tickets, 'pending'); // Beklemede
      case 2: return filterTicketsByStatus(tickets, 'in_progress'); // İşlemde
      case 3: return filterTicketsByStatus(tickets, 'resolved'); // Çözüldü
      default: return filterTicketsByStatus(tickets);
    }
  };

  const handleMainTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setMainTab(newValue);
    setStatusTab(0); // Reset status tab
    setPage(0); // Reset pagination
    setSearchTerm(''); // Reset search
    setPriorityFilter('all'); // Reset filters
    setIssueTypeFilter('all');
  };

  const handleStatusTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setStatusTab(newValue);
    setPage(0); // Reset pagination
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, ticket: SupportTicket | CustomerSupportTicket) => {
    setAnchorEl(event.currentTarget);
    if (mainTab === 0) {
      setSelectedDriverTicket(ticket as SupportTicket);
      setSelectedCustomerTicket(null);
    } else {
      setSelectedCustomerTicket(ticket as CustomerSupportTicket);
      setSelectedDriverTicket(null);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDriverTicket(null);
    setSelectedCustomerTicket(null);
  };

  const handleViewTicket = () => {
    // Ensure we have a selected ticket before opening the modal
    const currentTicket = selectedDriverTicket || selectedCustomerTicket;
    if (!currentTicket) {
      setError('Görüntülenecek destek talebi bulunamadı');
      setAnchorEl(null);
      return;
    }
    
    setViewDialogOpen(true);
    setAnchorEl(null);
  };

  const handleReplyTicket = () => {
    // Seçili bileti geçici değişkende sakla
    const currentTicket = selectedDriverTicket || selectedCustomerTicket;
    if (currentTicket) {
      setTicketToReply(currentTicket);
      setReplyDialogOpen(true);
      setAdminResponse('');
    }
    handleMenuClose();
  };

  const handleUpdateStatus = async (status: string, comment?: string, specificTicket?: SupportTicket | CustomerSupportTicket) => {
    console.log('🚀 handleUpdateStatus called with:', { status, comment });
    console.log('📋 Selected tickets:', { selectedDriverTicket, selectedCustomerTicket });
    console.log('📑 Main tab:', mainTab);
    console.log('🎯 Specific ticket provided:', specificTicket?.id);
    
    const currentTicket = specificTicket || selectedDriverTicket || selectedCustomerTicket;
    if (!currentTicket) {
      console.log('❌ No current ticket found, returning');
      return;
    }

    try {
      console.log('⏳ Setting updatingTicket to true');
      setUpdatingTicket(true);
      
      const updateData: any = { status };
      if (comment) {
        updateData.admin_response = comment;
      }
      
      console.log('📤 About to update ticket:', currentTicket.id, 'with data:', updateData);
      console.log('🌐 API Base URL:', API_CONFIG.BASE_URL);
      
      // Bilet tipini kontrol et - driver_name varsa sürücü bileti, customer_name varsa müşteri bileti
      const isDriverTicket = 'driver_name' in currentTicket;
      const isCustomerTicket = 'customer_name' in currentTicket;
      
      console.log('🔍 Ticket type check:', { isDriverTicket, isCustomerTicket, ticketId: currentTicket.id });
      
      if (isDriverTicket) {
        console.log('🚗 Updating driver ticket via API call...');
        console.log('🔗 API URL will be:', `${API_CONFIG.BASE_URL}/admin/support-tickets/${currentTicket.id}`);
        const result = await supportService.updateTicket(currentTicket.id, updateData);
        console.log('✅ Driver ticket update result:', result);
        console.log('🔄 Fetching updated driver tickets...');
        await fetchDriverTickets();
      } else if (isCustomerTicket) {
        console.log('👤 Updating customer ticket via API call...');
        console.log('🔗 API URL will be:', `${API_CONFIG.BASE_URL}/admin/customer-support-tickets/${currentTicket.id}`);
        const result = await supportService.updateCustomerTicket(currentTicket.id, updateData);
        console.log('✅ Customer ticket update result:', result);
        console.log('🔄 Fetching updated customer tickets...');
        await fetchCustomerTickets();
      } else {
        console.log('⚠️ Unknown ticket type, cannot determine API endpoint');
        throw new Error('Bilet tipi belirlenemedi');
      }
      
      console.log('🎉 Update completed successfully');
      // Clear menu and selected tickets after successful update
      setAnchorEl(null);
      setSelectedDriverTicket(null);
      setSelectedCustomerTicket(null);
    } catch (err: any) {
      console.error('💥 Update error:', err);
      console.error('💥 Error details:', err.response?.data);
      console.error('💥 Error status:', err.response?.status);
      setError(err.message || 'Durum güncellenirken bir hata oluştu');
    } finally {
      console.log('🏁 Setting updatingTicket to false');
      setUpdatingTicket(false);
    }
  };

  const handleResolveTicket = () => {
    // Seçili bileti geçici değişkende sakla
    const currentTicket = selectedDriverTicket || selectedCustomerTicket;
    if (currentTicket) {
      setTicketToResolve(currentTicket);
      setResolveDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleRejectTicket = () => {
    // Seçili bileti geçici değişkende sakla
    const currentTicket = selectedDriverTicket || selectedCustomerTicket;
    if (currentTicket) {
      setTicketToReject(currentTicket);
      setRejectDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleConfirmResolve = async () => {
    console.log('🚀 handleConfirmResolve FONKSIYONU ÇAĞRILDI!');
    console.log('Resolve Comment:', resolveComment);
    console.log('🎯 Ticket to resolve:', ticketToResolve?.id);
    
    if (!resolveComment.trim()) {
      console.log('❌ Resolve comment boş, işlem iptal edildi');
      return;
    }
    
    if (!ticketToResolve) {
      console.log('❌ No ticket to resolve found');
      return;
    }
    
    try {
      setUpdatingTicket(true);
      await handleUpdateStatus('resolved', resolveComment, ticketToResolve);
      setResolveDialogOpen(false);
      setResolveComment('');
      setTicketToResolve(null);
    } catch (err: any) {
      console.error('Resolve error:', err);
      setError(err.message || 'Destek talebi çözüldü olarak işaretlenirken bir hata oluştu');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectComment.trim()) return;
    
    if (!ticketToReject) {
      console.log('❌ No ticket to reject found');
      return;
    }
    
    try {
      setUpdatingTicket(true);
      await handleUpdateStatus('rejected', rejectComment, ticketToReject);
      setRejectDialogOpen(false);
      setRejectComment('');
      setTicketToReject(null);
    } catch (err: any) {
      console.error('Reject error:', err);
      setError(err.message || 'Destek talebi reddedilirken bir hata oluştu');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleSendReply = async () => {
    if (!ticketToReply) {
      console.log('❌ No ticket to reply found');
      return;
    }
    if (!adminResponse.trim()) return;

    try {
      setUpdatingTicket(true);
      
      // Bilet tipini kontrol et
      const isDriverTicket = 'driver_name' in ticketToReply;
      const isCustomerTicket = 'customer_name' in ticketToReply;
      
      if (isDriverTicket) {
        await supportService.updateTicket(ticketToReply.id, {
          admin_response: adminResponse,
          status: 'in_progress'
        });
        await fetchDriverTickets();
      } else if (isCustomerTicket) {
        await supportService.updateCustomerTicket(ticketToReply.id, {
          admin_response: adminResponse,
          status: 'in_progress'
        });
        await fetchCustomerTickets();
      }
      
      setReplyDialogOpen(false);
      setAdminResponse('');
      setTicketToReply(null);
    } catch (err: any) {
      setError(err.message || 'Yanıt gönderilirken bir hata oluştu');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const filteredTickets = getCurrentTickets();
  const paginatedTickets = filteredTickets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SupportIcon />
        Destek Talepleri
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {/* Ana Sekmeler - Sürücü/Müşteri */}
          <Tabs
            value={mainTab}
            onChange={handleMainTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab
              icon={<DriverIcon />}
              label={`Sürücü (${driverTickets.length})`}
              iconPosition="start"
            />
            <Tab
              icon={<CustomerIcon />}
              label={`Müşteri (${customerTickets.length})`}
              iconPosition="start"
            />
          </Tabs>

          {/* Durum Sekmeleri */}
          <Tabs
            value={statusTab}
            onChange={handleStatusTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label={`Tümü (${filterTicketsByStatus(mainTab === 0 ? driverTickets : customerTickets).length})`} />
            <Tab label={`Beklemede (${filterTicketsByStatus(mainTab === 0 ? driverTickets : customerTickets, 'pending').length})`} />
            <Tab label={`İşlemde (${filterTicketsByStatus(mainTab === 0 ? driverTickets : customerTickets, 'in_progress').length})`} />
            <Tab label={`Çözüldü (${filterTicketsByStatus(mainTab === 0 ? driverTickets : customerTickets, 'resolved').length})`} />
          </Tabs>

          {/* Filtreler ve Arama */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              placeholder={`${mainTab === 0 ? 'Sürücü' : 'Müşteri'} destek taleplerinde ara...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />
            
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Öncelik</InputLabel>
              <Select
                value={priorityFilter}
                label="Öncelik"
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <SelectMenuItem value="all">Tümü</SelectMenuItem>
                <SelectMenuItem value="urgent">Acil</SelectMenuItem>
                <SelectMenuItem value="high">Yüksek</SelectMenuItem>
                <SelectMenuItem value="medium">Orta</SelectMenuItem>
                <SelectMenuItem value="low">Düşük</SelectMenuItem>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Konu Türü</InputLabel>
              <Select
                value={issueTypeFilter}
                label="Konu Türü"
                onChange={(e) => setIssueTypeFilter(e.target.value)}
              >
                <SelectMenuItem value="all">Tümü</SelectMenuItem>
                <SelectMenuItem value="technical">Teknik</SelectMenuItem>
                <SelectMenuItem value="payment">Ödeme</SelectMenuItem>
                <SelectMenuItem value="order">Sipariş</SelectMenuItem>
                <SelectMenuItem value="account">Hesap</SelectMenuItem>
                <SelectMenuItem value="other">Diğer</SelectMenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Tablo */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>{mainTab === 0 ? 'Sürücü' : 'Müşteri'}</TableCell>
                  <TableCell>Konu</TableCell>
                  <TableCell>Tür</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell>Öncelik</TableCell>
                  <TableCell>Tarih</TableCell>
                  <TableCell>İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.id}</TableCell>
                    <TableCell>
                      {mainTab === 0 
                        ? ((ticket as SupportTicket).driver_name || 'Bilinmiyor')
                        : ((ticket as CustomerSupportTicket).customer_name || 'Bilinmiyor')
                      }
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {ticket.subject}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ticket.message.length > 50 
                          ? `${ticket.message.substring(0, 50)}...` 
                          : ticket.message
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getIssueTypeLabel(ticket.issue_type)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(ticket.status)}
                        color={getStatusColor(ticket.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getPriorityLabel(ticket.priority)}
                        color={getPriorityColor(ticket.priority) as any}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(ticket.created_at).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => handleMenuClick(e, ticket)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredTickets.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Sayfa başına satır:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </CardContent>
      </Card>

      {/* Menü */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewTicket}>
          <VisibilityIcon sx={{ mr: 1 }} />
          Görüntüle
        </MenuItem>
        <MenuItem onClick={handleReplyTicket}>
          <ReplyIcon sx={{ mr: 1 }} />
          Yanıtla
        </MenuItem>
        <MenuItem onClick={() => handleUpdateStatus('in_progress')}>
          <ScheduleIcon sx={{ mr: 1 }} />
          İşleme Al
        </MenuItem>
        <MenuItem onClick={handleResolveTicket}>
          <CheckCircleIcon sx={{ mr: 1 }} />
          Çöz
        </MenuItem>
        <MenuItem onClick={handleRejectTicket}>
          <CancelIcon sx={{ mr: 1 }} />
          Reddet
        </MenuItem>
      </Menu>

      {/* Görüntüleme Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => { setViewDialogOpen(false); setSelectedDriverTicket(null); setSelectedCustomerTicket(null); }} maxWidth="md" fullWidth>
        <DialogTitle>
          Destek Talebi Detayları - #{(selectedDriverTicket || selectedCustomerTicket)?.id}
        </DialogTitle>
        <DialogContent>
          {(selectedDriverTicket || selectedCustomerTicket) && (() => {
            const currentTicket = selectedDriverTicket || selectedCustomerTicket;
            return (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {currentTicket!.subject}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip
                  label={getStatusLabel(currentTicket!.status)}
                  color={getStatusColor(currentTicket!.status) as any}
                  size="small"
                />
                <Chip
                  label={getPriorityLabel(currentTicket!.priority)}
                  color={getPriorityColor(currentTicket!.priority) as any}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={getIssueTypeLabel(currentTicket!.issue_type)}
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Typography variant="body1" paragraph>
                <strong>{mainTab === 0 ? 'Sürücü' : 'Müşteri'}:</strong>{' '}
                {mainTab === 0 
                  ? (currentTicket! as SupportTicket).driver_name || 'Bilinmiyor'
                  : (currentTicket! as CustomerSupportTicket).customer_name || 'Bilinmiyor'
                }
              </Typography>

              <Typography variant="body1" paragraph>
                <strong>Mesaj:</strong>
              </Typography>
              <Typography variant="body2" paragraph sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                {currentTicket!.message}
              </Typography>

              {currentTicket!.admin_response && (
                <>
                  <Typography variant="body1" paragraph>
                    <strong>Admin Yanıtı:</strong>
                  </Typography>
                  <Typography variant="body2" paragraph sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1 }}>
                    {currentTicket!.admin_response}
                  </Typography>
                </>
              )}

              <Typography variant="caption" color="text.secondary">
                Oluşturulma: {new Date(currentTicket!.created_at).toLocaleString('tr-TR')}
              </Typography>
              {currentTicket!.resolved_at && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Çözülme: {new Date(currentTicket!.resolved_at).toLocaleString('tr-TR')}
                </Typography>
              )}
            </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewDialogOpen(false); setSelectedDriverTicket(null); setSelectedCustomerTicket(null); }}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {/* Yanıt Dialog */}
      <Dialog open={replyDialogOpen} onClose={() => setReplyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Destek Talebine Yanıt Ver - #{(selectedDriverTicket || selectedCustomerTicket)?.id}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Admin Yanıtı"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={adminResponse}
            onChange={(e) => setAdminResponse(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyDialogOpen(false)} disabled={updatingTicket}>
            İptal
          </Button>
          <Button 
            onClick={handleSendReply} 
            variant="contained" 
            disabled={!adminResponse.trim() || updatingTicket}
          >
            {updatingTicket ? <CircularProgress size={20} /> : 'Gönder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Çözüldü Dialog */}
      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Destek Talebini Çöz - #{(selectedDriverTicket || selectedCustomerTicket)?.id}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bu destek talebini çözüldü olarak işaretlemek için çözüm açıklaması yazınız.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Çözüm Açıklaması"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={resolveComment}
            onChange={(e) => setResolveComment(e.target.value)}
            placeholder="Bu talep nasıl çözüldü? Detayları açıklayınız..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)} disabled={updatingTicket}>
            İptal
          </Button>
          <Button 
            onClick={() => {
              console.log('🔥 ÇÖZÜLDÜ OLARAK İŞARETLE BUTONUNA BASILDI!');
              console.log('Resolve Comment:', resolveComment);
              console.log('Selected Driver Ticket:', selectedDriverTicket);
              console.log('Selected Customer Ticket:', selectedCustomerTicket);
              console.log('Main Tab:', mainTab);
              handleConfirmResolve();
            }} 
            variant="contained" 
            color="success"
            disabled={!resolveComment.trim() || updatingTicket}
          >
            {updatingTicket ? <CircularProgress size={20} /> : 'Çözüldü Olarak İşaretle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reddet Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Destek Talebini Reddet - #{(selectedDriverTicket || selectedCustomerTicket)?.id}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bu destek talebini reddetmek için red gerekçesini yazınız.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Red Gerekçesi"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Bu talep neden reddedildi? Gerekçeyi açıklayınız..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={updatingTicket}>
            İptal
          </Button>
          <Button 
            onClick={handleConfirmReject} 
            variant="contained" 
            color="error"
            disabled={!rejectComment.trim() || updatingTicket}
          >
            {updatingTicket ? <CircularProgress size={20} /> : 'Reddet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupportTicketsPage;