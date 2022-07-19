package util

import "strings"

func GenerateUrl(parts ...string) string {
	return "/" + strings.Join(deleteEmpty(parts), "/") + "/"
}

func deleteEmpty(s []string) []string {
	var r []string
	for _, str := range s {
		if str != "" {
			r = append(r, str)
		}
	}
	return r
}
