pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOSITORIES)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "texnocam-miniapp"
include(":app")
project(":app").projectDir = file("android/app")
