import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PrivacyPolicy = () => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gizlilik Politikası</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gizlilik Sözleşmesi</Text>
          <Text style={styles.paragraph}>
            Yükle Gel Taksi, internet sitesini ziyaret eden sizlerin paylaşmış olduğu bilgilerin gizliliğini sağlamayı ilke olarak kabul etmiştir. Bu nedenle işbu "Gizlilik Politikası" sizlerin hangi bilgilerinin, hangi yollarla ve hukuka uygun hangi amaç çerçevesinde Yükle Gel Taksi tarafından işlendiğini, bu bilgilerin hukuka uygun olarak ve vermiş olduğunuz izin kapsamında hangi üçüncü kişiler ile paylaşıldığını ve Yükle Gel Taksi tarafından ne şekilde korunduğunu açıklayarak sizi bilgilendirmek amacı ile oluşturulmuştur. Yükle Gel Taksi tarafından sizlere her türlü kanaldan sunulan tüm hizmetler kısaca "Hizmet" olarak anılacaktır.
          </Text>
          <Text style={styles.lastUpdated}>
          Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
        </Text>
        
        <Text style={styles.websiteLink}>
          Detaylı bilgi için: https://www.yuklegeltaksi.com/gizlilik-sozlesmesi.php
        </Text>
        </View>

        {/* Section 1: Scope */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GİZLİLİK POLİTİKASININ KAPSAMI</Text>
          <Text style={styles.paragraph}>
            Sunulan hizmetin bir parçası olarak Yükle Gel Taksi, hizmet alan sizlere ilişkin bilgileri işbu Gizlilik Politikası kapsamında elde edebilir ve aktarabilir. Bu tür bilgi aktarımları, üçüncü kişiler tarafından belirlenen şartlara ve üçüncü kişiler ile mevcut sözleşmelere ve yürürlükteki mevcut yasal mevzuata uygun olarak yapılır. Bu Gizlilik Politikası, bilgi aktarımı yapılan üçüncü kişilerin gizlilik uygulamalarını yansıtmamaktadır ve onların gizlilik politikalarından veya uygulamalarından Yükle Gel Taksi sorumlu değildir. İşbu Gizlilik Politikası Yükle Gel Taksi'in kendi kontrolü dışındaki uygulamalar, üçüncü taraflara ait internet siteleri ve platformlar tarafından toplanılan bilgiler, üçüncü taraflarca Yükle Gel Taksi internet sitesindeki bağlantılar üzerinden toplanan bilgiler veya Yükle Gel Taksi'in sponsor olduğu ve/veya katıldığı üçüncü taraf internet siteleri üzerindeki başlıklar, kampanyalar ve diğer reklam veya tanıtımları kapsamamaktadır. Üçüncü tarafların kendi internet siteleri yoluyla topladığı, sakladığı ve kullandığı kişisel verilere yönelik yapılan işlemlerden Yükle Gel Taksi sorumlu değildir.
          </Text>
        </View>

        {/* Section 2: Collected Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOPLANAN VERİLER</Text>
          <Text style={styles.paragraph}>
            Yükle Gel Taksi tarafından, verilen Hizmetler kapsamında birtakım kişisel verileriniz işlenmektedir. Bu kişisel veriler şunları içerebilir: ad-soyad, T.C. Kimlik Numarası, uyruk bilgisi, anne adı, baba adı, doğum yeri, doğum tarihi, cinsiyet, vergi numarası, SGK numarası, imza bilgisi, fotoğraf, taşıt plakası, telefon numarası, adres, e-posta adresi, faks numarası, IP adresi, sosyal medya hesapları, konum bilgileri, ürün veya hizmet satın almanızla ilgili bilgiler, ödeme bilgileri, sitemizde görüntülediğiniz sayfalar, sitemizi mobil cihazınız ile ziyaret etmeniz halinde mobil cihazınızı tanıtan veriler ve tarafımıza vermeyi açıkça ve yazılı olarak tercih ettiğiniz ve onayladığınız veya üçüncü kişilerden bu açık onayınız ile elde edebileceğimiz diğer her tür bilgiye tarafımızdan erişilebilir ve bu bilgiler işlenebilir.
          </Text>
        </View>

        {/* Section 3: Cookie Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ÇEREZ KULLANIMI</Text>
          <Text style={styles.paragraph}>
            Yükle Gel Taksi, yukarıda anılan kişisel verilerden bazılarını teknik bir iletişim dosyasını (Çerez-Cookie) kullanarak elde edebilir. Bahsi geçen teknik iletişim dosyaları, ana bellekte saklanmak üzere bir internet sitesinin kullanıcının tarayıcısına (browser) gönderdiği küçük metin dosyalarıdır. Teknik iletişim dosyası bir internet sitesi hakkında durum ve tercihleri saklayarak İnternet'in kullanımını kolaylaştırır. Teknik iletişim dosyası, internet sitesini kaç kişinin kullandığını, bir kişinin internet sitesini hangi amaçla, kaç kez ziyaret ettiğini ve ne kadar kaldıkları hakkında istatistiksel bilgileri elde etmeye ve kullanıcılar için özel tasarlanmış kullanıcı sayfalarından dinamik olarak reklam ve içerik üretilmesine yardımcı olur. Teknik iletişim dosyası, ana bellekte veya e-postanızdan veri veya başkaca herhangi bir kişisel veri almak için tasarlanmamıştır. Tarayıcıların pek çoğu başta teknik iletişim dosyasını kabul eder biçimde tasarlanmıştır ancak kullanıcılar dilerse teknik iletişim dosyasının gelmemesi veya teknik iletişim dosyasının gönderildiğinde ikaz verilmesini sağlayacak biçimde ayarları değiştirebilirler.
          </Text>
        </View>

        {/* Section 4: Information Update and Changes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BİLGİ GÜNCELLEME VE DEĞİŞİKLİK</Text>
          <Text style={styles.paragraph}>
            Yükle Gel Taksi, gizlilik ve veri koruma prensiplerini güncel tutmak ve ilgili mevzuata uygun hale getirmek için işbu Gizlilik Politikası'nın içeriğini dilediği zaman değiştirebilir. Değişen Gizlilik Politikası Yükle Gel Taksi internet sitesinde ilan edilecektir. Gizlilik Politikası'nın güncel haline www.yuklegeltaksi.com adresinden sürekli olarak ulaşmanız mümkündür. İşbu Gizlilik Politikası'nın değiştirilmesinden sonra Yükle Gel Taksi'in hizmet ve/veya uygulamalarını kullanmaya devam etmeniz halinde yapılan değişiklikleri kabul ettiğiniz varsayılır. Yükle Gel Taksi'in değişiklik yaptığı Gizlilik Politikası hükümleri internet sitesinde yayınlandığı tarihte yürürlük kazanır.
          </Text>
          <Text style={styles.paragraph}>
            www.yuklegeltaksi.com adresinden iletişim bilgilerinizin ve tercihlerinizin doğru, tam ve güncel olmasına yardımcı olabilirsiniz. Elimizdeki diğer kişisel veriler açısından; yanlış olan bir bilgiyi düzeltmemizi ya da yasa gereği veya meşru ticari amaçlar ile saklamasının gerekmediği bilginin silinmesini talep edebilirsiniz.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Yükle Gel Taksi Mobil Teknoloji A.Ş.
          </Text>
          <Text style={styles.footerText}>
            Tüm hakları saklıdır.
          </Text>
        </View>
      </ScrollView>
    </View>
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
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 12,
    textAlign: 'justify',
  },
  lastUpdated: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginBottom: 8,
    paddingLeft: 10,
  },
  footer: {
    backgroundColor: '#fff',
    marginVertical: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  footerText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  websiteLink: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
});

export default PrivacyPolicy;