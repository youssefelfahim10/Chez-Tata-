import java.util.Properties

plugins {
    id("com.android.application")
}

// Hôte du site : -PtwaHost=… ou variable d'environnement TWA_HOST, sinon valeur de gradle.properties.
val twaHost: String = (System.getenv("TWA_HOST") ?: (project.findProperty("twaHost") as String?) ?: "cheztata.app").trim()
require(Regex("^[a-z0-9.-]+$").matches(twaHost)) { "twaHost invalide : $twaHost" }
val twaStartPath: String = (project.findProperty("twaStartPath") as String?) ?: "/aujourdhui"
val appId: String = (project.findProperty("appId") as String?) ?: "fr.cheztata.app"

// Numéro de version : Play exige un versionCode strictement croissant. La CI passe -PversionCode=$GITHUB_RUN_NUMBER.
val vCode: Int = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
val vName: String = (project.findProperty("versionName") as String?) ?: "1.0.0"

// La clé de signature n'est JAMAIS dans le dépôt : elle vient de variables d'environnement (CI) ou de keystore.properties (local, ignoré par git).
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signingValue(env: String, key: String): String? = System.getenv(env) ?: keystoreProps.getProperty(key)
val storeFilePath = signingValue("ANDROID_KEYSTORE_FILE", "storeFile")

android {
    namespace = "fr.cheztata.app"
    compileSdk = 36

    defaultConfig {
        applicationId = appId
        minSdk = 23
        targetSdk = 36
        versionCode = vCode
        versionName = vName
        manifestPlaceholders["twaHost"] = twaHost
        manifestPlaceholders["twaStartPath"] = twaStartPath
        resValue("string", "twa_host", twaHost)
        buildConfigField("String", "TWA_HOST", "\"$twaHost\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (storeFilePath != null) {
            create("release") {
                storeFile = file(storeFilePath)
                storePassword = signingValue("ANDROID_KEYSTORE_PASSWORD", "storePassword")
                keyAlias = signingValue("ANDROID_KEY_ALIAS", "keyAlias")
                keyPassword = signingValue("ANDROID_KEY_PASSWORD", "keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sans clé fournie, le paquet reste non signé (le build local sans secret ne plante pas).
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.0")
}
