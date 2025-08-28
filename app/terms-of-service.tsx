import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const TermsOfServiceScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanım Şartları</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YükleGel Taksi Kullanım Şartları</Text>
          <Text style={styles.paragraph}>
            YükleGel Taksi Mobil Teknoloji A.Ş. ("YükleGel Taksi"), taksi sürücüleri ("Sürücü") ile müşterileri ("Müşteri") bir araya getiren bir teknoloji platformudur ("Uygulama"). Bu kullanım şartları, YükleGel Taksi uygulamasının kullanımına ilişkin hüküm ve koşulları belirler.
          </Text>
          <Text style={styles.lastUpdated}>
            Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
          </Text>
        </View>

        {/* Section 1: Application and Membership */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. BAŞVURU VE ÜYELİK</Text>
          <Text style={styles.subsectionTitle}>1.1. Kayıt İşlemi</Text>
          <Text style={styles.paragraph}>
            Müşteri, Uygulama'yı indirip, kayıt için gerekli olan bölümleri doldurup GSM numarasını onayladıktan sonra şifresini girerek, işbu Kullanım Koşulları'na uygun olarak Uygulama'yı kullanmaya başlayabilir.
          </Text>
          <Text style={styles.subsectionTitle}>1.2. Bilgi Doğruluğu</Text>
          <Text style={styles.paragraph}>
            Müşteri, başvuru esnasında verdiği tüm bilgilerin daima ve her bakımdan eksiksiz, gerçeğe uygun ve güncel olduğunu kabul eder. Müşteri, her zaman kişisel bilgilerini Uygulama aracılığıyla güncelleyebilir.
          </Text>
        </View>

        {/* Section 2: Application Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. UYGULAMANIN KULLANIMI</Text>
          <Text style={styles.subsectionTitle}>2.1. Taksi Çağırma</Text>
          <Text style={styles.paragraph}>
            Müşteri, Uygulama'ya kayıt olup Uygulama'yı açtıktan sonra taksi çağırma butonuna tıkladığında, Uygulama aracılığıyla, bulunduğu konuma en yakın olan taksi kendisine yönlendirilir ve Sürücü çağrıyı kabul ettiği takdirde; Sürücü ve araca ait bilgiler Müşteri'ye ulaştırılır.
          </Text>
          <Text style={styles.subsectionTitle}>2.2. Bilgi Doğruluğu</Text>
          <Text style={styles.paragraph}>
            YükleGel Taksi, yönlendirilen araca ilişkin verilen bilgilerin (tahmini varış süresi, aracın Müşteri'ye olan uzaklığı vb.) gerçeği yansıtması adına elinden geleni azami çabayı gösterir. Ancak bu bilgilerin %100 gerçeği yansıtmamasından dolayı sorumlu tutulamaz.
          </Text>
          <Text style={styles.subsectionTitle}>2.3. İptal Koşulları</Text>
          <Text style={styles.paragraph}>
            Müşteri, sürücü çağrıyı kabul ettikten sonra yolculuğu iptal edebilir. İptal ücreti aşağıdaki durumlarda uygulanır:
          </Text>
          <Text style={styles.bulletPoint}>• Sürücü çağrıyı kabul ettikten 90 saniye sonra iptal edilmesi</Text>
          <Text style={styles.bulletPoint}>• Sürücünün müşteriye 500 metre yaklaşmış olması</Text>
          <Text style={styles.bulletPoint}>• Tahmini geliş süresinden en fazla 3 dakika geçmiş olması</Text>
          <Text style={styles.paragraph}>
            Bu durumda 50 TL iptal ücreti uygulanır. Sürücünün müşteri konumuna gelmediği durumlarda iptal ücreti alınmaz.
          </Text>
        </View>

        {/* Section 3: Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. ÖDEME VE ÜCRETLER</Text>
          <Text style={styles.subsectionTitle}>3.1. Ödeme Yükümlülüğü</Text>
          <Text style={styles.paragraph}>
            Müşteri, Uygulama'yı kullanarak gerçekleştirdiği taksi yolculuğunun ve YükleGel Taksi hizmet bedelinin tamamını ödemekle yükümlüdür.
          </Text>
          <Text style={styles.subsectionTitle}>3.2. Ödeme Yöntemleri</Text>
          <Text style={styles.paragraph}>
            Müşteri, yolculuk ücretini nakit olarak sürücüye veya uygulama üzerinden kredi/banka kartı ile ödeyebilir. Kartlı ödemelerde, yolculuk sonunda sürücü taksimetrede yazan tutarı girer ve müşteri onaylar.
          </Text>
          <Text style={styles.subsectionTitle}>3.3. Hizmet Bedeli</Text>
          <Text style={styles.paragraph}>
            Her yolculuk için platform hizmet bedeli uygulanır. Bu bedel, taksi bulmanızı kolaylaştırmak ve platform hizmetlerini geliştirmek amacıyla tahsil edilir.
          </Text>
        </View>

        {/* Section 4: User Responsibilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. KULLANICI SORUMLULUKLARI</Text>
          <Text style={styles.subsectionTitle}>4.1. Uygun Kullanım</Text>
          <Text style={styles.paragraph}>
            Müşteri, uygulamayı yasalara uygun şekilde kullanmakla yükümlüdür. Sahte bilgi vermek, sistemi kötüye kullanmak veya diğer kullanıcılara zarar verecek davranışlarda bulunmak yasaktır.
          </Text>
          <Text style={styles.subsectionTitle}>4.2. Taksiyi Bekleme</Text>
          <Text style={styles.paragraph}>
            Müşterinin gelen taksiyi beklememesi veya gelen taksiye geçerli bir sebep olmaksızın binmemesi durumunda, YükleGel Taksi Müşteri'yi Uygulama'dan çıkarma hakkını saklı tutar.
          </Text>
        </View>

        {/* Section 5: Platform Responsibilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. PLATFORM SORUMLULUKLARI</Text>
          <Text style={styles.subsectionTitle}>5.1. Aracılık Hizmeti</Text>
          <Text style={styles.paragraph}>
            YükleGel Taksi, müşteriler ve sürücüler arasında aracılık hizmeti sunan bir teknoloji platformudur. Sürücülerin davranışları, araç durumu veya yolculuk kalitesi ile ilgili doğrudan sorumlu değildir.
          </Text>
          <Text style={styles.subsectionTitle}>5.2. Güvenlik</Text>
          <Text style={styles.paragraph}>
            Platform, kullanıcı güvenliğini sağlamak için gerekli teknik önlemleri alır. Ancak, yolculuk sırasında yaşanabilecek olaylardan platform sorumlu tutulamaz.
          </Text>
        </View>

        {/* Section 6: Privacy and Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. GİZLİLİK VE VERİ KORUMA</Text>
          <Text style={styles.subsectionTitle}>6.1. Kişisel Verilerin İşlenmesi</Text>
          <Text style={styles.paragraph}>
            Kişisel verileriniz, KVKK (Kişisel Verilerin Korunması Kanunu) kapsamında işlenir. Detaylı bilgi için Gizlilik Politikamızı inceleyebilirsiniz.
          </Text>
          <Text style={styles.subsectionTitle}>6.2. Veri Paylaşımı</Text>
          <Text style={styles.paragraph}>
            Sürücüler, yolculuk sırasında müşterinin adı, soyadının baş harfi ve konum bilgisini görür. Bu bilgiler yolculuk sonunda silinir.
          </Text>
        </View>

        {/* Section 7: Termination */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. HESABİN SONLANDIRILMASI</Text>
          <Text style={styles.paragraph}>
            YükleGel Taksi, kullanım şartlarını ihlal eden kullanıcıların hesaplarını askıya alma veya sonlandırma hakkını saklı tutar. Kullanıcılar da hesaplarını istedikleri zaman kapatabilirler.
          </Text>
        </View>

        {/* Section 8: Changes to Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. ŞARTLARDA DEĞİŞİKLİK</Text>
          <Text style={styles.paragraph}>
            YükleGel Taksi, bu kullanım şartlarını önceden bildirimde bulunarak değiştirme hakkını saklı tutar. Değişiklikler uygulama üzerinden duyurulur ve yürürlüğe girer.
          </Text>
        </View>

        {/* Section 9: Dispute Resolution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. UYUŞMAZLIK ÇÖZÜMÜ</Text>
          <Text style={styles.paragraph}>
            Bu sözleşmeden doğacak uyuşmazlıklarda Türkiye Cumhuriyeti yasaları geçerlidir. Uyuşmazlıklar İstanbul mahkemelerinde çözülür.
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. İLETİŞİM</Text>
          <Text style={styles.paragraph}>
            Sorularınız için bizimle iletişime geçebilirsiniz:
          </Text>
          <Text style={styles.contactInfo}>E-posta: destek@yuklegeltaksi.com</Text>
          <Text style={styles.contactInfo}>Telefon: 0850 XXX XX XX</Text>
          <Text style={styles.contactInfo}>Adres: İstanbul, Türkiye</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 YükleGel Taksi Mobil Teknoloji A.Ş.
          </Text>
          <Text style={styles.footerText}>
            Tüm hakları saklıdır.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    lineHeight: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 8,
    textAlign: 'justify',
  },
  bulletPoint: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 4,
    marginLeft: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
  },
  contactInfo: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default TermsOfServiceScreen;