import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraPermissionResponse } from 'expo-image-picker';

export const useImagePicker = (
  cameraPermission: CameraPermissionResponse | null,
  requestCameraPermission: () => Promise<CameraPermissionResponse>,
  setCargoImages: React.Dispatch<React.SetStateAction<string[]>>,
  showModal: (title: string, message: string, type: 'success' | 'error' | 'info') => void,
  setShowImagePickerModal?: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const handleImagePicker = () => {
    if (setShowImagePickerModal) {
      setShowImagePickerModal(true);
    }
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      if (source === 'camera') {
        // useCameraPermissions hook'unu kullan
        console.log('🔍 Kamera izni kontrol ediliyor...');
        console.log('📱 Mevcut kamera izni durumu:', cameraPermission?.status);
        
        // Eğer izin verilmemişse, izin iste
        if (cameraPermission?.status !== 'granted') {
          console.log('📝 Kamera izni isteniyor...');
          const permissionResult = await requestCameraPermission();
          console.log('📋 İzin sonucu:', permissionResult?.status);
          
          if (permissionResult?.status !== 'granted') {
            Alert.alert(
              'Kamera İzni Gerekli',
              'Fotoğraf çekebilmek için kamera izni gereklidir. Ayarlardan izni açabilirsiniz.',
              [
                { text: 'İptal', style: 'cancel' },
                { 
                  text: 'Ayarlara Git', 
                  onPress: () => Linking.openSettings() 
                }
              ]
            );
            return;
          }
        }
        
        console.log('✅ Kamera izni onaylandı');
        console.log('📸 Kamera açılıyor...');
        
        // Android'de kamera açma sorunları için kısa bir bekleme süresi ekle
        if (Platform.OS === 'android') {
          console.log('⏳ Android için bekleme süresi...');
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Kamera açma işlemini try-catch ile sarmalayalım
        try {
          console.log('🚀 launchCameraAsync çağrılıyor...');
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            base64: false,
            exif: false,
          });
          console.log('📷 Kamera sonucu alındı:', {
            canceled: result.canceled,
            assetsLength: result.assets?.length
          });
        } catch (cameraError) {
          console.error('❌ Kamera açma hatası:', cameraError);
          throw new Error('Kamera açılamadı. Lütfen tekrar deneyin.');
        }
      } else {
        // Galeri seçimi için izin kontrolü
        console.log('🔍 Galeri izni kontrol ediliyor...');
        const mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        let mediaStatus = mediaPermission.status;
        console.log('📱 Mevcut galeri izni durumu:', mediaStatus);
        
        // Eğer izin verilmemişse, izin iste
        if (mediaStatus !== 'granted') {
          console.log('📝 Galeri izni isteniyor...');
          const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          mediaStatus = permissionResult.status;
          console.log('📋 İzin sonucu:', mediaStatus);
        }
        
        // İzin verilmediyse kullanıcıyı uyar
        if (mediaStatus !== 'granted') {
          console.log('❌ Galeri izni reddedildi');
          Alert.alert(
            'Galeri İzni Gerekli',
            'Fotoğraf seçebilmek için galeri izni gereklidir. Ayarlardan izni açabilirsiniz.',
            [
              { text: 'İptal', style: 'cancel' },
              { 
                text: 'Ayarlara Git', 
                onPress: () => Linking.openSettings() 
              }
            ]
          );
          return;
        }
        
        console.log('✅ Galeri izni onaylandı');
        
        console.log('📱 Galeri açılıyor...');
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        console.log('🖼️ Galeri sonucu alındı:', {
          canceled: result.canceled,
          assetsLength: result.assets?.length
        });
      }
      
      console.log('🔍 Result kontrolü:', {
        canceled: result.canceled,
        assets: result.assets,
        assetsLength: result.assets?.length,
        resultType: typeof result,
        resultKeys: Object.keys(result)
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('✅ Fotoğraf seçimi başarılı, işleniyor...');
        const newImages = result.assets.map((asset, index) => {
          console.log(`📸 Asset ${index}:`, {
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            type: asset.type
          });
          return asset.uri;
        });
        console.log('🖼️ Yeni resimler:', newImages);
        
        setCargoImages(prev => {
          const updated = [...prev, ...newImages];
          console.log('📋 Güncellenmiş cargoImages:', updated);
          console.log('📊 Toplam fotoğraf sayısı:', updated.length);
          return updated;
        });
        
        // Başarı mesajı göster
        showModal('Başarılı', `${newImages.length} fotoğraf başarıyla eklendi.`, 'success');
      } else {
        console.log('❌ Resim seçilmedi veya iptal edildi:', {
          canceled: result.canceled,
          hasAssets: !!result.assets,
          assetsLength: result.assets?.length || 0
        });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      console.error('Error details:', {
        message: errorMessage,
        error: error
      });
      showModal('Hata', `Resim seçilirken bir hata oluştu: ${errorMessage}`, 'error');
    }
  };

  return { handleImagePicker, pickImage };
};