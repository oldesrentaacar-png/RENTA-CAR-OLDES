pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "OLDESSistema"
include(":app")

// Gradle/Android build outputs on D: when C: is low on space.
gradle.beforeProject {
    if (project.path == ":" || project.path == ":app") {
        project.layout.buildDirectory.set(
            file("D:/CURSOR/apk-android-build/${project.name.replace(":", "")}"),
        )
    }
}
